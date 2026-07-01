# Federal Polytechnic Oko — Student Result Portal

A fully client-side, GitHub Pages–ready academic result checking portal for Federal Polytechnic Oko.

---

## 📁 Project Structure

```
/
├── index.html       ← Main portal page (landing + dashboard)
├── style.css        ← All styling (responsive, dark mode)
├── app.js           ← All logic (search, render, charts, PDF)
├── data.js          ← Auto-generated student data (from Excel)
└── README.md
```

---

## 🚀 Deploy to GitHub Pages (3 steps)

1. **Create a new GitHub repository** (e.g. `fpo-results`)
2. **Upload all 4 files** (`index.html`, `style.css`, `app.js`, `data.js`)
3. Go to **Settings → Pages → Source → `main` branch / `/ (root)`** → Save

Your portal will be live at:  
`https://your-username.github.io/fpo-results/`

---

## 🔍 How Students Search

Students can search by:
- **Matric Number** — e.g. `FPO/CV/HA/23/001` (slashes optional)
- **Full Name** — partial match works, e.g. `Chinemezu`

---

## 📊 Features

| Feature | Status |
|---|---|
| Semester Result Slip | ✅ |
| Sessional (Annual) Result | ✅ |
| Academic Transcript | ✅ |
| Course Registration | ✅ |
| GPA / CGPA Calculator | ✅ |
| Academic Progress Chart | ✅ |
| Course Statistics & Charts | ✅ |
| Degree Classification | ✅ |
| Carry-Over Course Indicator | ✅ |
| Print Result Slip | ✅ |
| Download PDF | ✅ |
| Dark Mode | ✅ |
| Responsive / Mobile | ✅ |
| Verification Code on Slip | ✅ |
| Admin Settings Panel | ✅ (UI only — needs backend for edits) |

---

## 🔄 Updating Results (New Session)

When you have a new Excel results file:

1. Re-run the Python extraction script:
   ```bash
   python extract_full.py   # update the xlsx path inside
   python build_dataset.py
   python3 -c "
   import json
   with open('dataset_for_js.json') as f: data = json.load(f)
   with open('data.js', 'w') as f:
       f.write('const RESULT_DATA = ')
       json.dump(data, f, separators=(',', ':'))
       f.write(';')
   "
   ```
2. Replace `data.js` in your GitHub repo — all 200 students update instantly.

---

## 🔧 Connecting a Backend (Optional)

The portal is designed to be **progressively enhanced** with a backend:

### Firebase (Recommended for free hosting)
```js
// In app.js, replace the RESULT_DATA lookups with:
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const db = getFirestore(app);
const snap = await getDoc(doc(db, 'students', matricNumber));
const student = snap.data();
```

### Supabase (SQL-based alternative)
```js
const { data } = await supabase
  .from('students')
  .select('*, sem1_scores(*), sem2_scores(*)')
  .eq('matric', matricNumber)
  .single();
```

---

## 🎨 Customisation

| What | Where |
|---|---|
| University name / address | `data.js` → `meta` object, also `index.html` footer |
| Colour palette | `style.css` → `:root` CSS variables |
| Grading scale | `app.js` → `GRADE_SCALE` array |
| Degree classification | `app.js` → `DEGREE_CLASS` array |
| Logo (replace 🎓 emoji) | `index.html` `.brand-mark` and `.crest` divs |

---

## 📄 License

MIT — free to use, modify, and deploy for educational institutions.
