"""Build Sovereign V15 from the V14 build.

Starting budgets are seeded near a sustainable balance, ideology presets arrive funded, ten new
reforms join the Reforms list, and the Cities tab can queue a development in every city at once.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'build'; BUILD.mkdir(exist_ok=True)
SRC = ROOT / 'src'

s = (BUILD / 'v14.html').read_text()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:110])
    s = s.replace(a, b)

rep('<title>Sovereign V14 — Agencies &amp; Choose Your Country</title>',
    '<title>Sovereign V15 — Funded Budgets &amp; New Reforms</title>')
rep('Political sandbox · V14</div>', 'Political sandbox · V15</div>')
rep("s.version!==14", "s.version!==15")
rep("()=>{closeModal();actions.load();}", "()=>actions.load()", count=2)
# An era determines the starting partitions; the live world determines the drawn ones.
rep("const replaced=new Set(Object.keys(partitionsFor()));",
    "const replaced=new Set(Object.values(S.partitioned||{}).map(info=>info.parent));")


# A province uses the Crown's fill, with an administrative seam in place of a national outline.
rep("ctx.strokeStyle='#18262b';ctx.lineWidth=.7/t.scale;ctx.stroke(item.path);",
    "const admin=S.kingdom&&KINGDOM_REGION_IDS.has(item.id);"
    "ctx.strokeStyle=admin?'#b2a475':'#18262b';ctx.lineWidth=(admin?.45:.7)/t.scale;"
    "ctx.setLineDash(admin?[2/t.scale,2/t.scale]:[]);ctx.stroke(item.path);ctx.setLineDash([]);")
rep("if(territoryOwner(p.id)===id)ctx.stroke(p.path);",
    "if(territoryOwner(p.id)===id&&!(S.kingdom&&id===KINGDOM.id&&KINGDOM_REGION_IDS.has(p.id)))ctx.stroke(p.path);")
rep("(n.pop*c.share).toFixed(3)", "(n.pop*(c.populationShare??c.share)).toFixed(3)")
rep("if(closest)return closest;ctx.save()",
    "if(closest)return S.kingdom&&kingdomRegionAt(mx,my)?KINGDOM.id:closest;ctx.save()")
rep("if(id)choose(id)}drag=null",
    "if(id)selectMapNationKingdom(id,e.clientX-r.left,e.clientY-r.top)}drag=null")


# V12 attached its budget fit in render(). Opening the Ideologies tab only calls renderPanel(), which
# rebinds the preset buttons without it, so in ordinary play the fit never ran. V15 attaches preset
# funding in bindPanel, which every panel draw goes through; the render-level hook is retired so the
# two cannot stack.
rep("""// Presets are staged through the budget filter.
const v11RenderV12=render;
render=function(){
 v11RenderV12();
 if(!budgetFitEnabled())return;
 for(const b of $('panel').querySelectorAll('[data-preset]')){
  const original=b.onclick;
  b.onclick=()=>{original&&original();
   if(draft){const before=fiscal(current(),draft).balance;
    draft=fitToBudgetV12(draft,current());
    const after=fiscal(current(),draft).balance;
    if(after-before>.2)toast('Preset staged and trimmed to fit the budget: '+pct(after)+' of GDP.');}
   renderPanel();updateReformPreview();};}
};""",
    """// Preset budget handling moved to bindPanel in V15: this render-level hook missed every panel draw
// that did not go through render(), including opening the Ideologies tab.""")

# Sandbox and the ideology page describe what a preset now does.
rep("Fit ideology presets to the budget<input", "Fund ideology presets<input")
rep("'Staging an ideology trims its discretionary spending until the projected deficit is within about 4% of output. "
    "Taxes, institutions and civil liberties are left alone, so the ideology keeps its character.'",
    "'Staging an ideology sets the broad tax rate that pays for it, so the budget balance stays where it was — "
    "or recovers to a sustainable level if it was already worse. Smaller-state presets cut the rate instead. "
    "Tax structure, brackets, institutions and civil liberties are left alone.'")
rep("Presets stage an editable economic package. Your tax structure, housing programs, civil liberties and "
    "electoral safeguards stay independently adjustable.",
    "Presets stage an editable economic package that pays for itself: the broad tax rate is set so the budget "
    "balance stays where it was. Your tax structure, housing programs, civil liberties and electoral safeguards "
    "stay independently adjustable.")

# Two sentences in the V12 guide stopped being true: presets now move taxes, and since V13 a beaten
# country can be annexed.
rep("ideology presets are trimmed to fit the budget without touching their taxes or institutions",
    "ideology presets are fitted to the budget without touching institutions (from V15 they arrive funded "
    "by the broad tax rate)")
rep("Taking a city costs the defender the output and the confidence that went with it; borders still never move.",
    "Taking a city costs the defender the output and the confidence that went with it; since V13, breaking an "
    "enemy army decisively also lets you annex the country.")

css = '''
/* V15: the national rollout sits above the single-city development list. */
.rollout select{margin-bottom:12px}
.rollout .rolloutplan{margin:4px 0 12px}
/* The V5 cities panel never closes its grid of stat cards, so local management, the construction queue
   and the development list were laid out as grid cells a hundred-odd pixels wide. Anything in that grid
   that is not a stat card now spans the full row. */
.previewgrid>:not(.minicard){grid-column:1/-1}
'''
rep('</style>', css + '\n</style>')

kingdom_map = (SRC / 'data' / 'kingdom-map-supplement.json').read_text().strip()
rep('<script id="world-data"', '<script type="application/json" id="kingdom-map">'
    + kingdom_map + '</script>\n<script id="world-data"')
addon = '\n'.join((SRC / 'addons' / name).read_text()
                  for name in ('v15-addon.js', 'kingdom-addon.js', 'kingdom-finance.js'))
rep('newGame();initPaths();render();installMobileMap();startScreen();',
    addon + '\nnewGame();initPaths();render();installMobileMap();startScreen();')

(BUILD / 'v15.html').write_text(s)
(BUILD / 'v15-engine.js').write_text(re.findall(r'<script>([\s\S]*?)</script>', s)[-1])
(ROOT / 'dist' / 'sovereign-v15.html').write_text(s)
print('Built V15:', len(s.encode()), 'bytes')
