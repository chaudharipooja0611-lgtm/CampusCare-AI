"""Generates ml/data/complaints.csv (text, category, priority).

The dataset is synthetic: hand-written campus complaint sentences per category and
priority, combined with openers, locations and closers to create varied samples.
Replace / extend it with real complaints for production (admin corrections are also
saved to data/feedback.csv and automatically used when retraining).
"""
import csv
import os
import random

random.seed(42)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "complaints.csv")

S = {
 "Technical": {
  "High": ["The entire campus wifi network is down and online exams cannot be conducted",
           "Exam portal server crashed and students cannot submit their assignments before the deadline",
           "Lab computers are infected with a virus and all student data may be lost",
           "The college website and student login portal are completely not working",
           "Internet is completely down in the data center and the servers are unreachable"],
  "Medium": ["Wifi signal is very weak and keeps disconnecting",
             "The projector in the classroom is not turning on",
             "Lab computer keeps freezing and the software installation fails",
             "Printer in the computer lab is not working",
             "I cannot log in to the student portal with my password"],
  "Low": ["Request to install an additional software package on the lab systems",
          "The mouse and keyboard of the lab computer need replacement",
          "Please upgrade the internet speed of the department when possible",
          "Suggest adding more network ports and laptop charging stations"]},
 "Electrical": {
  "High": ["Sparks coming from the electrical switchboard and there is a burning smell",
           "Exposed live wires are hanging in the corridor, danger of electric shock",
           "Complete power outage in the hostel block since last night",
           "Short circuit caused smoke from the main electrical panel",
           "Transformer is making loud noise and the power supply keeps tripping"],
  "Medium": ["Ceiling fan in the classroom is not working",
             "Several tube lights are not working in the corridor",
             "The power socket near my desk is loose and not working",
             "Air conditioner in the seminar hall is not cooling",
             "Voltage fluctuation keeps switching off the lab equipment"],
  "Low": ["Please replace the dim bulb in the stairwell",
          "Street light near the parking is flickering sometimes",
          "Request to add one more plug point in the study room",
          "Suggest installing energy saving LED lamps in the department"]},
 "Maintenance": {
  "High": ["Water pipe burst and the floor is flooded near the entrance",
           "Ceiling plaster is falling in the classroom and may hurt students",
           "Sewage overflow in the washroom with terrible smell spreading",
           "There is no drinking water supply for the last two days",
           "A large crack has appeared in the wall of the old building"],
  "Medium": ["Washroom tap is leaking continuously",
             "Broken benches and desks in the classroom need repair",
             "Dustbins are overflowing and garbage is not cleared regularly",
             "Door lock of the room is broken and the door does not close",
             "The water cooler is dirty and needs cleaning"],
  "Low": ["Walls of the corridor need repainting",
          "Please trim the overgrown grass near the playground",
          "Request to polish the old wooden notice boards",
          "Suggest placing more benches under the trees"]},
 "Accounts": {
  "High": ["Fee payment was deducted from my bank but not updated and the last date is today",
           "Scholarship amount has not been credited for six months and I cannot pay my dues",
           "Wrong late fine charged and my exam hall ticket is blocked due to pending fees",
           "Refund of the caution deposit is pending and urgently required",
           "Double payment of tuition fee was deducted from my account"],
  "Medium": ["Receipt for the tuition fee payment is not generated",
             "Fee structure shown in the portal is different from the notice",
             "Need correction of my name in the fee receipt",
             "Exam fee payment shows failed but the money was debited",
             "Hostel fee invoice has a calculation mistake"],
  "Low": ["Request for a duplicate fee receipt for my records",
          "Please share the fee installment schedule for next semester",
          "Query about the process to update bank details for refunds",
          "Suggest adding a UPI payment option at the accounts office"]},
 "Safety": {
  "High": ["Ragging and harassment of juniors is happening in the hostel",
           "Fire broke out in the laboratory and the fire extinguisher is empty",
           "Unknown strangers are entering the girls hostel at night",
           "A student was injured in an accident and first aid was not available",
           "Theft happened in the hostel rooms and the security guard was absent"],
  "Medium": ["CCTV cameras in the parking area are not working",
             "Fire exit door is blocked with boxes",
             "The road near the campus gate is poorly lit and unsafe at night",
             "Security guard does not check identity cards at the entrance",
             "Stray dogs are roaming near the hostel and scaring students"],
  "Low": ["Suggest adding more safety signboards on the campus",
          "Request to conduct a fire drill awareness session",
          "Please paint the speed breakers near the gate to make them visible",
          "Suggest installing a few more mirrors at sharp corners"]},
 "Library": {
  "High": ["Library is locked during exam week and students cannot access reference books",
           "Digital library login is down and e-journals are inaccessible before the project submission",
           "Important reference book needed for tomorrow's exam is missing from the library",
           "Library staff misplaced my deposit and refuse to return my ID card"],
  "Medium": ["The issued book return date was wrongly shown and a fine is charged",
             "Library reading room is too noisy and the seating is insufficient",
             "Photocopy machine in the library is not working",
             "The book I reserved was given to someone else",
             "Library catalogue search is showing wrong availability of books"],
  "Low": ["Request to add new novels and magazines to the library",
          "Please extend the library opening hours on weekends",
          "Suggest buying more copies of popular textbooks",
          "Request to add comfortable chairs in the reading hall"]},
}
OPENERS = ["", "", "", "Hello, ", "Respected sir, ", "Hi team, ", "Please note: ", "Complaint: ", "I would like to report: "]
PLACES = ["Hostel Block A", "Computer Lab", "Main Building", "Cafeteria", "Library Block", "Engineering Block",
          "Boys Hostel", "Girls Hostel", "Admin Building", "Classroom 204", "Main Gate", "Seminar Hall"]
CLOSERS = {"High": ["Please resolve this urgently.", "This needs immediate action.", "It is an emergency.", "Very serious issue."],
           "Medium": ["Kindly fix it soon.", "Please look into this.", "It is affecting our daily work.", ""],
           "Low": ["Not urgent but please consider.", "No hurry, whenever possible.", "A small request.", "Just a suggestion."]}

rows = set()
gid = 0
for cat, levels in S.items():
    for pr, sentences in levels.items():
        for s in sentences:
            gid += 1
            for _ in range(14):
                text = f"{random.choice(OPENERS)}{s}. Location: {random.choice(PLACES)}. {random.choice(CLOSERS[pr])}".strip()
                rows.add((text, cat, pr, gid))

# ---- Compositional layer: campus topics x issue phrases (widens vocabulary coverage) ----
SUBJECTS = {
 "Technical": ["wifi router", "internet connection", "lab computers", "projector", "student portal", "college website",
               "online exam platform", "printer", "email account", "software licence", "server", "smart board",
               "learning management system login", "network switch", "laptop in the lab", "video conferencing system"],
 "Electrical": ["ceiling fan", "tube light", "power socket", "air conditioner", "main switchboard", "transformer",
                "backup generator", "electrical wiring", "street light", "inverter", "water heater geyser",
                "extension board", "lift motor power supply", "electric meter", "exhaust fan", "stage lighting"],
 "Maintenance": ["washroom", "water tap", "drinking water supply", "classroom benches", "roof", "drainage line",
                 "garbage bin", "corridor walls", "door lock", "window glass", "staircase", "playground",
                 "hostel room cupboard", "water cooler", "floor tiles", "campus garden"],
 "Accounts": ["tuition fee", "scholarship amount", "fee receipt", "refund request", "hostel fee", "exam fee",
              "bank transaction", "caution deposit", "online fee payment", "late fine", "stipend payment",
              "fee challan", "accounts office invoice", "fee installment", "transport fee", "bonafide fee"],
 "Safety": ["security guard", "CCTV camera", "fire extinguisher", "hostel gate", "fire exit", "first aid kit",
            "campus road at night", "stray dogs", "emergency alarm", "parking area security", "visitor entry register",
            "evacuation plan", "anti ragging committee", "women safety helpline", "lab safety equipment", "campus boundary wall"],
 "Library": ["library books", "reference section", "reading room", "e-journal access", "library card", "book issue counter",
             "library catalogue", "library photocopy machine", "study cubicles", "journal subscription",
             "library membership", "book return fine", "newspaper section", "library seating", "previous year question papers", "library silence"],
}
PROBLEMS = {
 "High": ["has stopped working completely and this is an emergency", "has a critical issue that needs immediate action",
          "has been out of service for days and many students are suffering", "is in a serious condition and cannot wait",
          "is hazardous and someone could get badly hurt", "has failed just before the exams and nothing is working for everyone",
          "may cause a major accident if not handled today", "is completely down and all students are affected"],
 "Medium": ["is not working properly", "has an issue and needs to be fixed soon", "has been giving trouble for a week",
            "needs attention and repair", "is making a strange noise and works slowly", "is damaged and needs replacement",
            "is not responding well at times", "shows an error again and again", "is delayed and still pending",
            "is dirty and not well maintained"],
 "Low": ["could be improved when possible", "needs a minor update, no hurry", "I suggest improving this when time permits",
         "has a small cosmetic problem", "would be nice to upgrade in future", "could use a little polishing sometime",
         "works fine but a small enhancement would help"],
}
for cat, subs in SUBJECTS.items():
    for sub in subs:
        for pr, probs in PROBLEMS.items():
            for pb in probs:
                gid += 1
                for _ in range(2):
                    text = f"{random.choice(OPENERS)}The {sub} {pb}. Location: {random.choice(PLACES)}. {random.choice(CLOSERS[pr])}".strip()
                    rows.add((text, cat, pr, gid))
rows = sorted(rows)
random.shuffle(rows)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["text", "category", "priority", "group"])
    w.writerows(rows)
print(f"Wrote {len(rows)} rows to {OUT}")
