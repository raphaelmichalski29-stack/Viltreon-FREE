import { chromium } from "playwright"
const url = "file:///C:/OpenCode%20Email%20AI/gmail-ai-sorter/landing-pages/viltreon-hero-fly-v2.html"
async function launch(){
  const args=["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]
  try { return await chromium.launch({headless:true,args}) } catch { return await chromium.launch({headless:true,channel:"chrome",args}) }
}
const browser = await launch()
const page = await browser.newPage({ viewport:{width:1320,height:860} })
const errors=[]
page.on("console", m=>{ if(m.type()==="error") errors.push(m.text()) })
page.on("pageerror", e=>errors.push("[pageerror] "+(e?.message||e)))
await page.goto(url, {waitUntil:"load", timeout:30000})
await page.waitForTimeout(1200)
const range = await page.evaluate(()=>{ const s=document.querySelector(".scroll"); return s.offsetHeight - innerHeight })
const frames = [["1-immersion",0.10],["2-words-mid",0.40],["3-words-full",0.49],["4-waterfall",0.74],["5-resolve",0.96]]
for (const [n,p] of frames){
  await page.evaluate(y=>window.scrollTo(0,y), Math.round(p*range))
  await page.waitForTimeout(1700)
  await page.screenshot({ path:"landing-pages/_v2_"+n+".png" })
}
console.log("errors:", errors.length); errors.slice(0,8).forEach(e=>console.log("  ERR:",e))
console.log(errors.length===0?"RESULT: OK":"RESULT: PROBLEM")
await browser.close(); process.exit(0)
