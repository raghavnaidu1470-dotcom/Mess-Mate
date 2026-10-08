// Government of Tamil Nadu, 2026 holiday notification, annexure pp. 4–5.
// Bank-only annual account closure is excluded. Update from the official notification each year.
const source='https://www.tn.gov.in/sites/default/holidays/public_e_708_2025.pdf';
const calendar:Record<string,string>={
 '2026-01-01':"New Year’s Day",'2026-01-15':'Pongal','2026-01-16':'Thiruvalluvar Day','2026-01-17':'Uzhavar Thirunal','2026-01-26':'Republic Day',
 '2026-02-01':'Thai Poosam','2026-03-19':"Telugu New Year’s Day",'2026-03-21':'Ramzan (Id-ul-Fitr)','2026-03-31':'Mahaveer Jayanthi',
 '2026-04-03':'Good Friday','2026-04-14':"Tamil New Year / Dr. B. R. Ambedkar’s Birthday",'2026-05-01':'May Day','2026-05-28':'Bakrid (Id-ul-Azha)',
 '2026-06-26':'Muharram','2026-08-15':'Independence Day','2026-08-26':'Milad-un-Nabi','2026-09-04':'Krishna Jayanthi','2026-09-14':'Vinayakar Chathurthi',
 '2026-10-02':'Gandhi Jayanthi','2026-10-19':'Ayutha Pooja','2026-10-20':'Vijaya Dasami','2026-11-08':'Deepavali','2026-12-25':'Christmas',
};
export function calendarFor(date:string){const name=calendar[date];return name?[{id:`calendar-${date}`,date,name,source,items:'[]'}]:[];}
