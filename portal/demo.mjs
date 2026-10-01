import {defaultAvatar,newRace} from './model.mjs';
const future=days=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);};
export function demoData() {
 const profiles=[
 {id:'demo-athlete',display_name:'Alex Rivera',location:'Brooklyn, NY',bio:'Early miles, late finish lines. Sharing the work behind my first full season of running and hybrid racing.',avatar:{...defaultAvatar,skin:'#b77d55'},socials:[{platform:'instagram',handle:'alex.example'}],audience:{total:24800,checked_at:new Date().toISOString(),demo:true}},
 {id:'demo-maya',display_name:'Maya Chen',location:'Austin, TX',bio:'Triathlete, weekend cyclist, and a big believer in showing the entire training journey.',avatar:{...defaultAvatar,presentation:'feminine',gender:'female',skin:'#d6a17c',kit:'#54697c',build:'lean'},socials:[],audience:{total:42600,demo:true}},
 {id:'demo-theo',display_name:'Theo Bennett',location:'Denver, CO',bio:'Long days on the trail. Training for my next ultra and bringing a community along.',avatar:{...defaultAvatar,presentation:'masculine',skin:'#69432f',kit:'#854b40',build:'strong'},socials:[],audience:{total:18200,demo:true}},
 {id:'demo-sam',display_name:'Sam Ellis',location:'Boston, MA',bio:'Running for the fun of it. Local races, honest training notes, and a very enthusiastic run club.',avatar:{...defaultAvatar,presentation:'feminine',gender:'female',skin:'#f0cbb2',kit:'#283e34'},socials:[],audience:{total:8900,demo:true}},
 {id:'demo-sponsor',display_name:'Example Run Co.',location:'New York, NY',bio:'Independent performance essentials.',avatar:defaultAvatar,socials:[],audience:null}
 ];
 const seeds=[
 ['demo-race-1','demo-athlete','City Hybrid Open','New York, NY','HYROX','Singles · 8 × 1K + stations',18,'shirtless',450,'70–85 minutes'],
 ['demo-race-2','demo-maya','Lakeside 70.3','Austin, TX','Triathlon','70.3 · 1.9K / 90K / 21.1K',32,'tri-suit',650,'5:30–6:00'],
 ['demo-race-3','demo-theo','High Country Ultra','Boulder, CO','Trail / ultramarathon','50K',45,'long-sleeve',350,'6–7 hours'],
 ['demo-race-4','demo-sam','Harbor Run','Boston, MA','Road running','5K',12,'tee',150,'22–25 minutes'],
 ['demo-race-5','demo-athlete','Autumn City Half','Philadelphia, PA','Road running','Half marathon · 21.1K',61,'singlet',400,'1:40–1:50'],
 ['demo-race-6','demo-theo','Mountain Endurance 200','Leadville, CO','Trail / ultramarathon','200K',90,'long-sleeve',800,'36–40 hours']
 ];
 return {profiles,listings:seeds.map(([id,athlete_id,event_name,location,discipline,distance,days,outfit,asking_price,finish_band])=>({...newRace(),id,athlete_id,event_name,location,discipline,distance,race_date:future(days),outfit,asking_price,finish_band,expected_field:discipline==='HYROX'?4500:1200,phase:discipline==='Triathlon'?'Bike + run':'Full race',placements:[...(profiles.find(p=>p.id===athlete_id)?.avatar.gender==='female'?['cleavage']:['left-pec','right-pec']),'back','left-shoulder','right-shoulder','left-forearm','right-forearm','left-calf','right-calf','left-thigh','right-thigh','butt'],rules_confirmed:true,status:'published',notes:'Fictional event for exploring the Athleet demo.'})),bookings:[],shortlist:[]};
}
