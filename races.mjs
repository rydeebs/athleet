export const raceTypes={
 'Road running':['5K','10K','Half marathon · 21.1K','Marathon · 42.2K','Custom distance'],
 'Trail / ultramarathon':['25K','50K','50 miles','100K','100 miles','200K','200 miles','Custom distance'],
 'Triathlon':['Sprint · 750m / 20K / 5K','Olympic · 1.5K / 40K / 10K','70.3 · 1.9K / 90K / 21.1K','140.6 · 3.8K / 180K / 42.2K','Custom distance'],
 'HYROX':['Singles · 8 × 1K + stations','Doubles · 8 × 1K + stations','Relay · 8 × 1K + stations'],
 'Cycling':['50K','100K','160K','200K','Custom distance'],
 'Other endurance':['Custom distance']
};
export function raceSummary(race){return {title:race.name.trim()||race.type,distance:race.distance==='Custom distance'?(race.custom.trim()||'Distance to confirm'):race.distance,date:race.date||'Date to confirm',location:race.location.trim()||'Location to confirm',field:race.field?Number(race.field).toLocaleString('en-US')+' participants expected':'Field size to confirm',finish:race.finish.trim()||'Finish band to confirm'};}
