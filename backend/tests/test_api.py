"""End-to-end API test (69 checks). Needs a running backend + demo data:  python init_db.py && python app.py
Then:  pip install requests && python tests/test_api.py   (creates a few complaints; run against a dev database only)."""
import requests, time, io
B="http://localhost:5000/api"; ok=0; bad=0
def chk(name, cond, extra=""):
    global ok,bad
    if cond: ok+=1
    else: bad+=1; print("FAIL:",name,extra)
def login(e,p): return requests.post(B+"/auth/login",json={"email":e,"password":p}).json()["token"]
H=lambda t:{"Authorization":"Bearer "+t}
adm=login("admin@campuscare.edu","admin123"); st=login("student@campuscare.edu","student123"); pr=login("priya@campuscare.edu","student123"); it=login("it@campuscare.edu","dept123"); el=login("electrical@campuscare.edu","dept123")

r=requests.get(B+"/health"); chk("health", r.status_code==200); chk("sec headers", r.headers.get("X-Content-Type-Options")=="nosniff" and r.headers.get("X-Frame-Options")=="DENY")
chk("config", requests.get(B+"/config").json()["sla_hours"]["High"]==24)
chk("weak pw", requests.post(B+"/auth/register",json={"name":"Weak User","email":"w@x.com","password":"abcdefgh"}).status_code==400)
chk("short pw", requests.post(B+"/auth/register",json={"name":"Weak User","email":"w@x.com","password":"a1"}).status_code==400)
em=f"u{int(time.time())}@x.com"; chk("register ok", requests.post(B+"/auth/register",json={"name":"New User","email":em,"password":"goodpass1"}).status_code==201)

p=requests.post(B+"/complaints/predict",json={"title":"Sparks","description":"Sparks from the switchboard with burning smell, act immediately"}).json()
e=p["prediction"]["explanation"]["category"]; chk("explanation", e["supporting_terms"] and e["predicted"]==p["prediction"]["category"] and p["sla_hours"]==24, str(p["sla_hours"]))
print("explain terms:",[t["term"] for t in e["supporting_terms"][:4]],"margin",e["margin"],"coverage",e["vocabulary_coverage"])

# fake image rejected, real accepted
png=bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")
d={"title":"Exposed live wire","description":"Exposed live wires hanging in the corridor, danger of electric shock","location":"Block B"}
chk("fake image", requests.post(B+"/complaints",headers=H(st),data=d,files={"image":("a.png",b"not an image at all","image/png")}).status_code==400)
r=requests.post(B+"/complaints",headers=H(st),data=d,files={"image":("a.png",png,"image/png")}).json()
chk("submit real img", r.get("ticket_id")); chk("auto-escalated", r["escalated"] and r["prediction"]["priority"]=="High", str(r)); cid=r["id"]
c=requests.get(B+f"/complaints/{cid}",headers=H(st)).json()["complaint"]
chk("detail sla", c["sla_state"]=="on_track" and c["escalation_level"]==1 and c["sla_seconds_left"]>86000, str((c["sla_state"],c["sla_seconds_left"])))
chk("detail explanation", c["explanation"]["category"]["supporting_terms"]); chk("img served", requests.get(B+"/uploads/"+c["image_path"]).status_code==200 and c["image_path"].endswith(".png"))
an=requests.get(B+"/notifications?filter=alerts",headers=H(adm)).json(); chk("admin critical notif", an["critical_unread"]>=1 and any(n["type"]=="escalation" for n in an["notifications"]))
chk("crit first", an["notifications"][0]["severity"]=="critical")

# legacy complaint lazily gets explanation
old=requests.get(B+"/complaints?sort=created_at&order=asc&per_page=1",headers=H(adm)).json()["complaints"][0]
chk("legacy explanation", requests.get(B+f"/complaints/{old['id']}",headers=H(adm)).json()["complaint"]["explanation"]["category"]["predicted"])

# SLA monitor
res=requests.post(B+"/admin/sla-check",headers=H(adm)).json()["result"]; print("sla result",res)
chk("sla breached found", res["breached"]>=0)
res2=requests.post(B+"/admin/sla-check",headers=H(adm)).json()["result"]; chk("sla idempotent", res2["breached"]==0 and res2["escalated"]==0 and res2["warned"]==0, str(res2))
chk("sla admin only", requests.post(B+"/admin/sla-check",headers=H(st)).status_code==403)

# filters / pagination
L=requests.get(B+"/complaints?overdue=1&per_page=5&page=1&sort=sla&order=asc",headers=H(adm)).json()
chk("overdue filter", L["total"]>=1 and all(x["sla_state"]=="overdue" for x in L["complaints"]), str(L["total"])); print("overdue total",L["total"],"pages",L["pages"])
chk("attention", requests.get(B+"/complaints?attention=1",headers=H(adm)).json()["total"]>=L["total"])
chk("multi status", requests.get(B+"/complaints?status=Assigned,In Progress",headers=H(adm)).json()["total"]>=1)
chk("bad sort", requests.get(B+"/complaints?sort=drop",headers=H(adm)).status_code==400); chk("bad status", requests.get(B+"/complaints?status=zzz",headers=H(adm)).status_code==400)
chk("bad date", requests.get(B+"/complaints?date_from=garbage",headers=H(adm)).status_code==400)
chk("date ok", requests.get(B+"/complaints?date_from=2020-01-01&date_to=2099-01-01&min_confidence=10",headers=H(adm)).json()["total"]>=1)
chk("sql inj q", requests.get(B+"/complaints?q=' OR 1=1 --",headers=H(adm)).json()["total"]==0)
chk("student scope", all(x["user_name"] for x in requests.get(B+"/complaints",headers=H(st)).json()["complaints"]) and requests.get(B+"/complaints",headers=H(st)).json()["total"]<requests.get(B+"/complaints",headers=H(adm)).json()["total"])
chk("legacy list shape", "complaints" in requests.get(B+"/complaints",headers=H(adm)).json())

# CSV export + injection
inj=requests.post(B+"/complaints",headers=H(st),data={"title":"=HYPERLINK(evil) library issue","description":"The library photocopy machine is not working at all","location":"Library"}).json()
x=requests.get(B+"/complaints/export?q=HYPERLINK",headers=H(adm)); chk("export", x.status_code==200 and "text/csv" in x.headers["content-type"] and "attachment" in x.headers["content-disposition"])
chk("csv injection safe", "'=HYPERLINK" in x.text and ",=HYPERLINK" not in x.text, x.text[:300])
chk("export scoped", requests.get(B+"/complaints/export",headers=H(st)).headers["X-Row-Count"]==str(requests.get(B+"/complaints",headers=H(st)).json()["total"]))
chk("export auth", requests.get(B+"/complaints/export").status_code==401)

# rating flow
chk("rate before resolve", requests.post(B+f"/complaints/{cid}/rating",headers=H(st),json={"rating":5}).status_code==400)
chk("student cant status", requests.patch(B+f"/complaints/{cid}/status",headers=H(st),json={"status":"Resolved","note":"x"}).status_code==403)
chk("resolve needs note", requests.patch(B+f"/complaints/{cid}/status",headers=H(el),json={"status":"Resolved"}).status_code==400)
chk("resolve", requests.patch(B+f"/complaints/{cid}/status",headers=H(el),json={"status":"Resolved","note":"Wires insulated"}).json()["complaint"]["sla_state"] in ("met",))
chk("dept cant reopen", requests.patch(B+f"/complaints/{cid}/status",headers=H(el),json={"status":"In Progress"}).status_code==403)
chk("other student cant rate", requests.post(B+f"/complaints/{cid}/rating",headers=H(pr),json={"rating":5}).status_code==403)
chk("bad rating", requests.post(B+f"/complaints/{cid}/rating",headers=H(st),json={"rating":9}).status_code==400)
r=requests.post(B+f"/complaints/{cid}/rating",headers=H(st),json={"rating":2,"feedback":"Took too long"}); chk("rate ok", r.status_code==200 and r.json()["complaint"]["rating"]==2)
chk("rate twice", requests.post(B+f"/complaints/{cid}/rating",headers=H(st),json={"rating":5}).status_code==409)
chk("low rating alert", any(n["type"]=="rating" for n in requests.get(B+"/notifications",headers=H(adm)).json()["notifications"]))
chk("admin reopen", requests.patch(B+f"/complaints/{cid}/status",headers=H(adm),json={"status":"In Progress","note":"Reopened after low rating"}).json()["complaint"]["status"]=="In Progress")

# manual escalation
cid2=inj["id"]; lib=login("library@campuscare.edu","dept123")
chk("esc other dept", requests.post(B+f"/complaints/{cid2}/escalate",headers=H(it),json={"reason":"needs boss"}).status_code==403)
chk("esc reason req", requests.post(B+f"/complaints/{cid2}/escalate",headers=H(lib),json={"reason":"x"}).status_code==400)
e1=requests.post(B+f"/complaints/{cid2}/escalate",headers=H(lib),json={"reason":"Machine needed for exams"}); chk("esc 1", e1.status_code==200 and e1.json()["complaint"]["escalation_level"]>=1)
lvl=e1.json()["complaint"]["escalation_level"]
if lvl<2: chk("esc 2", requests.post(B+f"/complaints/{cid2}/escalate",headers=H(lib),json={"reason":"Still broken"}).json()["complaint"]["escalation_level"]==2)
chk("esc max", requests.post(B+f"/complaints/{cid2}/escalate",headers=H(lib),json={"reason":"again again"}).status_code==400)

# priority correction recalculates SLA
c2=requests.patch(B+f"/complaints/{cid2}/correct",headers=H(adm),json={"priority":"Low"}).json()["complaint"]; chk("sla recalculated", c2["priority"]=="Low" and c2["sla_total_seconds"]==168*3600 and c2["sla_seconds_left"]>24*3600*3)

# analytics + report
a=requests.get(B+"/analytics",headers=H(adm)).json(); s=a["stats"]
chk("analytics keys", all(k in s for k in ("overdue","at_risk","escalated_open","sla_compliance","avg_rating","awaiting_rating")) and len(a["rating_distribution"])==5 and a["sla_by_priority"] and a["department_performance"]); print({k:s[k] for k in ("total","overdue","at_risk","escalated_open","sla_compliance","avg_rating")})
chk("dept analytics", requests.get(B+"/analytics",headers=H(it)).json()["stats"]["total"]<s["total"])
rp=requests.get(B+"/reports/summary",headers=H(adm)); chk("summary csv", rp.status_code==200 and "SLA by priority" in rp.text and "Department" in rp.text); chk("report student 403", requests.get(B+"/reports/summary",headers=H(st)).status_code==403)

# notification center
n=requests.get(B+"/notifications?filter=unread&limit=5",headers=H(adm)).json(); chk("unread filter", all(not x["is_read"] for x in n["notifications"]) and len(n["notifications"])<=5)
nid=n["notifications"][0]["id"]; before=n["unread"]
chk("read one", requests.post(B+f"/notifications/{nid}/read",headers=H(adm)).status_code==200 and requests.get(B+"/notifications",headers=H(adm)).json()["unread"]==before-1)
chk("cant read others", requests.post(B+f"/notifications/{nid}/read",headers=H(st)).status_code==404); chk("cant delete others", requests.delete(B+f"/notifications/{nid}",headers=H(st)).status_code==404)
chk("delete one", requests.delete(B+f"/notifications/{nid}",headers=H(adm)).status_code==200)
requests.post(B+"/notifications/read",headers=H(adm)); chk("read all", requests.get(B+"/notifications",headers=H(adm)).json()["unread"]==0)
cl=requests.delete(B+"/notifications",headers=H(adm)).json(); chk("clear read", cl["deleted"]>=1 and requests.get(B+"/notifications",headers=H(adm)).json()["total"]==0)

# regression: old features
chk("correct category", requests.patch(B+f"/complaints/{cid2}/correct",headers=H(adm),json={"category":"Technical"}).json()["complaint"]["department_name"]=="IT & Network Services")
chk("track", requests.get(B+f"/track/{inj['ticket_id']}").json()["complaint"]["ticket_id"]==inj["ticket_id"])
chk("depts", len(requests.get(B+"/departments",headers=H(st)).json()["departments"])>=6); chk("users forbidden", requests.get(B+"/users",headers=H(st)).status_code==403)
chk("retrain", requests.post(B+"/admin/retrain",headers=H(adm)).json()["metrics"]["samples"]>1000)
chk("big file", requests.post(B+"/complaints",headers=H(st),data=d,files={"image":("a.png",png+b"0"*6_000_000,"image/png")}).status_code==413)
chk("create weak user", requests.post(B+"/users",headers=H(adm),json={"name":"Staff","email":"s@x.com","password":"short","role":"admin"}).status_code==400)
# rate limit last
codes=[requests.post(B+"/auth/login",json={"email":"a@b.co","password":"x"}).status_code for _ in range(25)]; chk("rate limit 429", 429 in codes, str(set(codes)))
print(f"\nPASSED {ok}  FAILED {bad}")
