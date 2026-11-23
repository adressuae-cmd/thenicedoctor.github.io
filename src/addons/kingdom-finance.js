// Balances are in the same constant USD billions as the base engine.
const KINGDOM_FUND_RETURN = .035/12;
const originalKingdomFiscal = fiscal;
fiscal=function(n,p=n.policies){
 return originalKingdomFiscal(n,n.id===KINGDOM.id?{...p,sovereignFund:0}:p);
};

const originalKingdomMacro = macroV5;
macroV5=function(n,...args){
 const initialFund=n.fund;
 originalKingdomMacro(n,...args);
 if(n.id===KINGDOM.id)n.fund=initialFund*(1+KINGDOM_FUND_RETURN);
};

const originalKingdomDebt = accrueDebtV6;
accrueDebtV6=function(n,budget,oldGDP){
 if(n.id!==KINGDOM.id)return originalKingdomDebt(n,budget,oldGDP);
 const treasury=S.kingdom.treasury, opening=treasury.cash;
 const revenue=budget.revenue*oldGDP/1200;
 const spending=budget.spending*oldGDP/1200;
 const canBorrow=!debtDisabled()&&!debtFrozen();
 const interest=canBorrow?n.debt*budget.interest/1200:0;
 const net=opening+revenue-spending-interest;
 const financing=Math.max(0,-net);
 const borrowing=canBorrow?financing:0;
 treasury.cash=Math.max(0,net);
 treasury.last={
  month:S.month,opening,revenue,spending,interest,borrowing,
  unfunded:financing-borrowing,closing:treasury.cash
 };
 if(debtDisabled())n.debt=0;
 else if(canBorrow)n.debt=(n.debt+borrowing)/(1+n.inflation/1200);
};

function transferKingdomFunds(direction,amount){
 if(S.player!==KINGDOM.id||!['deposit','withdraw'].includes(direction)||
  !Number.isFinite(amount)||amount<=0)return false;
 const realm=player(),treasury=S.kingdom.treasury,deposit=direction==='deposit';
 const source=deposit?treasury.cash:realm.fund;
 const destination=deposit?realm.fund:treasury.cash;
 if(amount>source||!Number.isFinite(destination+amount))return false;
 treasury.cash+=deposit?-amount:amount;
 realm.fund+=deposit?amount:-amount;
 treasury.transfers.push({month:S.month,direction,amount});
 addEvent('أمر تحويل ملكي',deposit?'تحويل من الخزينة إلى الصندوق السيادي.':'تحويل من الصندوق السيادي إلى الخزينة.','economy');
 return true;
}

function validKingdomTreasury(treasury,month){
 const amount=value=>Number.isFinite(value)&&value>=0;
 const validMonth=value=>Number.isInteger(value)&&value>=0&&value<=month;
 if(!treasury||!amount(treasury.cash))return false;
 const {last,transfers}=treasury;
 if(last!==null){
  if(!last||!validMonth(last.month)||
   !['opening','revenue','spending','interest','borrowing','unfunded','closing'].every(key=>amount(last[key])))return false;
  const balance=last.opening+last.revenue+last.borrowing+last.unfunded-last.spending-last.interest;
  if(Math.abs(balance-last.closing)>1e-8*Math.max(1,last.opening,last.revenue,last.spending))return false;
 }
 return Array.isArray(transfers)&&transfers.every((transfer,index)=>
  !!transfer&&validMonth(transfer.month)&&
  (index===0||transfer.month>=transfers[index-1].month)&&
  ['deposit','withdraw'].includes(transfer.direction)&&amount(transfer.amount)&&transfer.amount>0);
}

const originalKingdomPolicyControl=policyControl;
policyControl=function(policy,n){
 if(n.id===KINGDOM.id&&policy.key==='sovereignFund')return '';
 return originalKingdomPolicyControl(policy,n);
};

const originalKingdomEconomy=economyPanel;
economyPanel=function(n){
 const base=originalKingdomEconomy(n);
 if(n.id!==KINGDOM.id)return base;
 const {cash,last}=S.kingdom.treasury;
 const transfer=n.id===S.player?'<label for="royalTransferAmount">المبلغ (مليار دولار)</label>'
  +'<input id="royalTransferAmount" type="number" min="0" step="any" dir="ltr">'
  +'<div class="buttonrow"><button id="royalDeposit">تحويل إلى الصندوق</button>'
  +'<button id="royalWithdraw">تحويل إلى الخزينة</button></div>':'';
 return '<section dir="rtl" lang="ar" class="block"><h3>الخزينة والصندوق السيادي</h3>'
  +metric('رصيد الخزينة',kingdomMoney(cash))+metric('رصيد الصندوق',kingdomMoney(n.fund))
  +(last?metric('إيرادات الشهر',kingdomMoney(last.revenue))+metric('نفقات الشهر المخططة',kingdomMoney(last.spending))
   +metric('فوائد الدين',kingdomMoney(last.interest))+metric('التمويل بالدين',kingdomMoney(last.borrowing))
   +metric('نفقات غير ممولة',kingdomMoney(last.unfunded)):'')
  +transfer+'</section>'+base;
};

const originalKingdomFinanceBindings=bindPanel;
bindPanel=function(){
 originalKingdomFinanceBindings();
 if(current()?.id!==KINGDOM.id||view!=='economy')return;
 for(const [id,direction] of [['royalDeposit','deposit'],['royalWithdraw','withdraw']]){
  const button=$('panel').querySelector('#'+id);
  if(!button)continue;
  button.onclick=()=>{
   const amount=Number($('royalTransferAmount').value);
   if(!transferKingdomFunds(direction,amount)){
    toast('أدخل مبلغاً موجباً لا يتجاوز الرصيد المتاح.');
    return;
   }
   renderPanel();
   toast('سُجّل أمر التحويل الملكي.');
  };
 }
};
