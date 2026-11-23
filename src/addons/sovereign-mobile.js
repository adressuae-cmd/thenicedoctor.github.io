function renderMobileViewPicker(){
 const nav=$('navigation');
 if(typeof document.createElement!=='function'||typeof nav.appendChild!=='function')return;
 const field=document.createElement('div');
 field.id='mobileViewField';
 const label=document.createElement('label');
 label.htmlFor='mobileViewSelect';
 label.textContent=kingdomLabel('Section');
 const picker=document.createElement('select');
 picker.id='mobileViewSelect';
 for(const button of nav.querySelectorAll('[data-view]')){
  const option=document.createElement('option');
  option.value=button.dataset.view;
  option.textContent=button.title;
  picker.appendChild(option);
 }
 picker.value=view;
 picker.onchange=()=>{
  const target=picker.value;
  setView(target);
  if(target==='help')picker.value=view;
 };
 field.append(label,picker);
 nav.appendChild(field);
}
