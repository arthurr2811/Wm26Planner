/* ===================== DATEN ===================== */
const TEAMS = {
  MEX:["Mexiko","🇲🇽"], KOR:["Südkorea","🇰🇷"], CZE:["Tschechien","🇨🇿"], RSA:["Südafrika","🇿🇦"],
  SUI:["Schweiz","🇨🇭"], CAN:["Kanada","🇨🇦"], QAT:["Katar","🇶🇦"], BIH:["Bosnien-Herz.","🇧🇦"],
  BRA:["Brasilien","🇧🇷"], MAR:["Marokko","🇲🇦"], HAI:["Haiti","🇭🇹"], SCO:["Schottland","🏴󠁧󠁢󠁳󠁣󠁴󠁿"],
  USA:["USA","🇺🇸"], PAR:["Paraguay","🇵🇾"], AUS:["Australien","🇦🇺"], TUR:["Türkei","🇹🇷"],
  GER:["Deutschland","🇩🇪"], CUW:["Curaçao","🇨🇼"], CIV:["Elfenbeinküste","🇨🇮"], ECU:["Ecuador","🇪🇨"],
  NED:["Niederlande","🇳🇱"], JPN:["Japan","🇯🇵"], TUN:["Tunesien","🇹🇳"], SWE:["Schweden","🇸🇪"],
  BEL:["Belgien","🇧🇪"], EGY:["Ägypten","🇪🇬"], IRN:["Iran","🇮🇷"], NZL:["Neuseeland","🇳🇿"],
  ESP:["Spanien","🇪🇸"], URU:["Uruguay","🇺🇾"], CPV:["Kap Verde","🇨🇻"], KSA:["Saudi-Arabien","🇸🇦"],
  FRA:["Frankreich","🇫🇷"], SEN:["Senegal","🇸🇳"], NOR:["Norwegen","🇳🇴"], IRQ:["Irak","🇮🇶"],
  ARG:["Argentinien","🇦🇷"], ALG:["Algerien","🇩🇿"], AUT:["Österreich","🇦🇹"], JOR:["Jordanien","🇯🇴"],
  POR:["Portugal","🇵🇹"], COL:["Kolumbien","🇨🇴"], UZB:["Usbekistan","🇺🇿"], COD:["DR Kongo","🇨🇩"],
  ENG:["England","🏴󠁧󠁢󠁥󠁮󠁧󠁿"], CRO:["Kroatien","🇭🇷"], GHA:["Ghana","🇬🇭"], PAN:["Panama","🇵🇦"]
};
const GROUPS = {
  A:["MEX","KOR","CZE","RSA"], B:["SUI","CAN","QAT","BIH"], C:["BRA","MAR","HAI","SCO"],
  D:["USA","PAR","AUS","TUR"], E:["GER","CUW","CIV","ECU"], F:["NED","JPN","TUN","SWE"],
  G:["BEL","EGY","IRN","NZL"], H:["ESP","URU","CPV","KSA"], I:["FRA","SEN","NOR","IRQ"],
  J:["ARG","ALG","AUT","JOR"], K:["POR","COL","UZB","COD"], L:["ENG","CRO","GHA","PAN"]
};
/* [Gruppe, Datum, Zeit, Heim, Gast, Ort] – Zeiten in MESZ */
const MATCHES = [
 ["A","Do 11.06.","21:00","MEX","RSA","Mexiko-Stadt"],
 ["A","Fr 12.06.","04:00","KOR","CZE","Guadalajara"],
 ["B","Fr 12.06.","21:00","CAN","BIH","Toronto"],
 ["D","Sa 13.06.","03:00","USA","PAR","Los Angeles"],
 ["B","Sa 13.06.","21:00","QAT","SUI","San Francisco"],
 ["C","So 14.06.","00:00","BRA","MAR","New Jersey"],
 ["C","So 14.06.","03:00","HAI","SCO","Boston"],
 ["D","So 14.06.","06:00","AUS","TUR","Vancouver"],
 ["E","So 14.06.","19:00","GER","CUW","Houston"],
 ["F","So 14.06.","22:00","NED","JPN","Dallas"],
 ["E","Mo 15.06.","01:00","CIV","ECU","Philadelphia"],
 ["F","Mo 15.06.","04:00","SWE","TUN","Monterrey"],
 ["H","Mo 15.06.","18:00","ESP","CPV","Atlanta"],
 ["G","Mo 15.06.","21:00","BEL","EGY","Seattle"],
 ["H","Di 16.06.","00:00","KSA","URU","Miami"],
 ["G","Di 16.06.","03:00","IRN","NZL","Los Angeles"],
 ["I","Di 16.06.","21:00","FRA","SEN","New Jersey"],
 ["I","Mi 17.06.","00:00","IRQ","NOR","Boston"],
 ["J","Mi 17.06.","03:00","ARG","ALG","Kansas City"],
 ["J","Mi 17.06.","06:00","AUT","JOR","San Francisco"],
 ["K","Mi 17.06.","19:00","POR","COD","Houston"],
 ["L","Mi 17.06.","22:00","ENG","CRO","Dallas"],
 ["L","Do 18.06.","01:00","GHA","PAN","Toronto"],
 ["K","Do 18.06.","04:00","UZB","COL","Mexiko-Stadt"],
 ["A","Do 18.06.","18:00","CZE","RSA","Atlanta"],
 ["B","Do 18.06.","21:00","SUI","BIH","Los Angeles"],
 ["B","Fr 19.06.","00:00","CAN","QAT","Vancouver"],
 ["A","Fr 19.06.","03:00","MEX","KOR","Guadalajara"],
 ["D","Fr 19.06.","21:00","USA","AUS","Seattle"],
 ["C","Sa 20.06.","00:00","SCO","MAR","Boston"],
 ["C","Sa 20.06.","02:30","BRA","HAI","Philadelphia"],
 ["D","Sa 20.06.","05:00","TUR","PAR","San Francisco"],
 ["F","Sa 20.06.","19:00","NED","SWE","Houston"],
 ["E","Sa 20.06.","22:00","GER","CIV","Toronto"],
 ["E","So 21.06.","02:00","ECU","CUW","Kansas City"],
 ["F","So 21.06.","06:00","TUN","JPN","Monterrey"],
 ["H","So 21.06.","18:00","ESP","KSA","Atlanta"],
 ["G","So 21.06.","21:00","BEL","IRN","Los Angeles"],
 ["H","Mo 22.06.","00:00","URU","CPV","Miami"],
 ["G","Mo 22.06.","03:00","NZL","EGY","Vancouver"],
 ["J","Mo 22.06.","19:00","ARG","AUT","Dallas"],
 ["I","Mo 22.06.","23:00","FRA","IRQ","Philadelphia"],
 ["I","Di 23.06.","02:00","NOR","SEN","New Jersey"],
 ["J","Di 23.06.","05:00","JOR","ALG","San Francisco"],
 ["K","Di 23.06.","19:00","POR","UZB","Houston"],
 ["L","Di 23.06.","22:00","ENG","GHA","Boston"],
 ["L","Mi 24.06.","01:00","PAN","CRO","Toronto"],
 ["K","Mi 24.06.","04:00","COL","COD","Guadalajara"],
 ["B","Mi 24.06.","21:00","SUI","CAN","Vancouver"],
 ["B","Mi 24.06.","21:00","BIH","QAT","Seattle"],
 ["C","Do 25.06.","00:00","SCO","BRA","Miami"],
 ["C","Do 25.06.","00:00","MAR","HAI","Atlanta"],
 ["A","Do 25.06.","03:00","CZE","MEX","Mexiko-Stadt"],
 ["A","Do 25.06.","03:00","RSA","KOR","Monterrey"],
 ["E","Do 25.06.","22:00","ECU","GER","New Jersey"],
 ["E","Do 25.06.","22:00","CUW","CIV","Philadelphia"],
 ["F","Fr 26.06.","01:00","TUN","NED","Kansas City"],
 ["F","Fr 26.06.","01:00","JPN","SWE","Dallas"],
 ["D","Fr 26.06.","04:00","TUR","USA","Los Angeles"],
 ["D","Fr 26.06.","04:00","PAR","AUS","San Francisco"],
 ["I","Fr 26.06.","21:00","NOR","FRA","Boston"],
 ["I","Fr 26.06.","21:00","SEN","IRQ","Toronto"],
 ["H","Sa 27.06.","02:00","URU","ESP","Guadalajara"],
 ["H","Sa 27.06.","02:00","CPV","KSA","Houston"],
 ["G","Sa 27.06.","05:00","NZL","BEL","Vancouver"],
 ["G","Sa 27.06.","05:00","EGY","IRN","Seattle"],
 ["L","Sa 27.06.","23:00","PAN","ENG","New Jersey"],
 ["L","Sa 27.06.","23:00","CRO","GHA","Philadelphia"],
 ["K","So 28.06.","01:30","COL","POR","Miami"],
 ["K","So 28.06.","01:30","COD","UZB","Atlanta"],
 ["J","So 28.06.","04:00","JOR","ARG","Dallas"],
 ["J","So 28.06.","04:00","ALG","AUT","Kansas City"]
];
/* K.o.-Runde: [Tag/Datum, Zeit, Ort, Heim-Slot, Gast-Slot]
   Slots sind maschinenlesbar (Anzeige-Text wird in app.js generiert):
     {g:"A",p:2}            = 2. Gruppe A
     {t:["A","B",...]}      = bester Gruppendritter aus diesen Gruppen
     {w:"r32:0"}            = Sieger des Spiels (Runde:Index)
     {l:"fin:0"}            = Verlierer des Spiels (Runde:Index) */
const R32 = [
 ["So 28.06.","21:00","Los Angeles",{g:"A",p:2},{g:"B",p:2}],
 ["Mo 29.06.","19:00","Houston",{g:"C",p:1},{g:"F",p:2}],
 ["Mo 29.06.","22:30","Boston",{g:"E",p:1},{t:["A","B","C","D","F"]}],
 ["Di 30.06.","03:00","Monterrey",{g:"F",p:1},{g:"C",p:2}],
 ["Di 30.06.","19:00","Dallas",{g:"E",p:2},{g:"I",p:2}],
 ["Di 30.06.","23:00","New Jersey",{g:"I",p:1},{t:["C","D","F","G","H"]}],
 ["Mi 01.07.","04:00","Mexiko-Stadt",{g:"A",p:1},{t:["C","E","F","H","I"]}],
 ["Mi 01.07.","18:00","Atlanta",{g:"L",p:1},{t:["E","H","I","J","K"]}],
 ["Mi 01.07.","22:00","Seattle",{g:"G",p:1},{t:["A","E","H","I","J"]}],
 ["Do 02.07.","02:00","San Francisco",{g:"D",p:1},{t:["B","E","F","I","J"]}],
 ["Do 02.07.","21:00","Los Angeles",{g:"H",p:1},{g:"J",p:2}],
 ["Fr 03.07.","01:00","Toronto",{g:"K",p:2},{g:"L",p:2}],
 ["Fr 03.07.","05:00","Vancouver",{g:"B",p:1},{t:["E","F","G","I","J"]}],
 ["Fr 03.07.","20:00","Dallas",{g:"D",p:2},{g:"G",p:2}],
 ["Sa 04.07.","00:00","Miami",{g:"J",p:1},{g:"H",p:2}],
 ["Sa 04.07.","03:30","Kansas City",{g:"K",p:1},{t:["D","E","I","J","L"]}]
];
const R16 = [
 ["Sa 04.07.","19:00","Houston",{w:"r32:0"},{w:"r32:3"}],
 ["Sa 04.07.","23:00","Philadelphia",{w:"r32:2"},{w:"r32:5"}],
 ["So 05.07.","22:00","New Jersey",{w:"r32:1"},{w:"r32:4"}],
 ["Mo 06.07.","03:00","Mexiko-Stadt",{w:"r32:6"},{w:"r32:7"}],
 ["Mo 06.07.","21:00","Dallas",{w:"r32:10"},{w:"r32:11"}],
 ["Di 07.07.","02:00","Seattle",{w:"r32:8"},{w:"r32:9"}],
 ["Di 07.07.","18:00","Atlanta",{w:"r32:13"},{w:"r32:14"}],
 ["Di 07.07.","22:00","Vancouver",{w:"r32:12"},{w:"r32:15"}]
];
const QF = [
 ["Do 09.07.","22:00","Boston",{w:"r16:0"},{w:"r16:1"}],
 ["Fr 10.07.","21:00","Los Angeles",{w:"r16:4"},{w:"r16:5"}],
 ["Sa 11.07.","23:00","Miami",{w:"r16:2"},{w:"r16:3"}],
 ["So 12.07.","03:00","Kansas City",{w:"r16:6"},{w:"r16:7"}]
];
const FINALS = [
 ["HF 1","Di 14.07.","21:00","Dallas",{w:"qf:0"},{w:"qf:1"}],
 ["HF 2","Mi 15.07.","21:00","Atlanta",{w:"qf:2"},{w:"qf:3"}],
 ["Platz 3","Sa 18.07.","23:00","Miami",{l:"fin:0"},{l:"fin:1"}],
 ["Finale","So 19.07.","21:00","New Jersey",{w:"fin:0"},{w:"fin:1"}]
];
