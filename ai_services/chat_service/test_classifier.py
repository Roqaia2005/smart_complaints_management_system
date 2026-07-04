"""
test_option_a.py

Tests the language-gated classify_complaint() function.
Run: python test_option_a.py
"""

import asyncio, sys
sys.path.insert(0, ".")

from services.classification_service import classify_complaint, _is_arabic

P = "\033[92mPASS\033[0m"
F = "\033[91mFAIL\033[0m"

def check(label, condition, detail=""):
    tag  = P if condition else F
    line = f"  {tag} | {label}"
    if detail: line += f"\n         {detail}"
    print(line)
    return condition

# Shared categories — same structure as get_categories_with_keywords returns
CATEGORIES = [
    {
        "id": 1,
        "name": "Labs / المعامل",
        "description": "Physical equipment failures and infrastructure issues in university buildings",
        "keywords": ["lab","laboratory","computer","internet","AC","air conditioning",
                     "projector","equipment","broken","hardware","network","electricity",
                     "device","screen","printer","معمل","تكييف","كمبيوتر","انترنت","بروجيكتور","عطل"],
    },
    {
        "id": 2,
        "name": "Examinations / الامتحانات",
        "description": "Academic grade disputes unfair marking and exam access issues",
        "keywords": ["grade","grades","marks","score","exam","test","midterm","final",
                     "unfair","barred","result","fail","assessment","evaluation","dispute",
                     "درجة","امتحان","ظلم","حرمان","نتيجة","درجات"],
    },
    {
        "id": 3,
        "name": "Registration / التسجيل",
        "description": "Course registration enrollment and academic schedule issues",
        "keywords": ["registration","course","semester","schedule","enroll","enrollment",
                     "withdrawal","timetable","add","drop","calendar",
                     "تسجيل","مادة","جدول","فصل","انسحاب","قيد"],
    },
]


print("\n" + "="*60)
print("TEST 1 — Language detection")
print("="*60)

t1 = []
cases = [
    ("the AC is broken in lab 10",                False, "English"),
    ("my grade is wrong in data mining",          False, "English"),
    ("التكييف مكسور في معمل 10",                  True,  "Arabic"),
    ("درجاتي غلط في الامتحان",                    True,  "Arabic"),
    ("the AC مكسور in lab معمل 10",               False, "Mixed — counted as English"),
    ("عايز اسجل مادة",                             True,  "Arabic"),
]
for text, expected_ar, label in cases:
    got = _is_arabic(text)
    t1.append(check(f"{label}: '{text[:35]}'",
        got == expected_ar,
        f"Expected is_arabic={expected_ar} Got={got}"))
print(f"\nTest 1: {sum(t1)}/{len(t1)}\n")


print("="*60)
print("TEST 2 — English complaints → semantic classifier")
print("="*60)

english_tests = [
    ("the AC is broken in lab 10 since last Monday",            1, "Labs"),
    ("the internet is not working in the laboratory",           1, "Labs"),
    ("my grade in data mining is wrong I lost 10 marks",       2, "Examinations"),
    ("I was barred from the final exam unfairly",               2, "Examinations"),
    ("the doctor gave me an unfair grade",                      2, "Examinations"),
    ("I cannot register for the optional course this semester", 3, "Registration"),
    ("I want to add a course to my schedule",                   3, "Registration"),
]

t2 = []
print()
for complaint, expected_id, expected_name in english_tests:
    result = asyncio.run(classify_complaint(complaint, CATEGORIES))
    if result is None:
        ok = False
        detail = f"Expected:{expected_name} Got:None (deferred to LLM)"
    else:
        ok = result["category_id"] == expected_id
        detail = (f"Expected:{expected_name} Got:{result['category_name']} "
                  f"Method:{result['method']}")
    t2.append(ok)
    check(f"'{complaint[:42]}'", ok, detail)

print(f"\nTest 2: {sum(t2)}/{len(t2)} ({100*sum(t2)//len(t2)}%)\n")


print("="*60)
print("TEST 3 — Arabic complaints → always deferred to LLM (returns None)")
print("="*60)

arabic_tests = [
    "التكييف مكسور في معمل 10",
    "الانترنت مش شغال في المعمل",
    "درجاتي غلط في مادة تعدين البيانات",
    "الدكتور اداني ظلم في الامتحان النهائي",
    "عايز اسجل مادة اختيارية",
    "مش قادر اتسجل في الفصل الجديد",
]

t3 = []
print()
for complaint in arabic_tests:
    result = asyncio.run(classify_complaint(complaint, CATEGORIES))
    ok = result is None
    t3.append(ok)
    check(
        f"'{complaint[:42]}'",
        ok,
        f"Got: {result} (should be None — LLM will decide)"
    )

print(f"\nTest 3: {sum(t3)}/{len(t3)} (all Arabic must return None)\n")


print("="*60)
print("TEST 4 — Edge cases")
print("="*60)

t4 = []

# No categories
result = asyncio.run(classify_complaint("the AC is broken", []))
t4.append(check("Empty categories → None", result is None))

# Unrelated English → None (low confidence)
result = asyncio.run(classify_complaint("the vending machine near the cafeteria is broken", CATEGORIES))
t4.append(check("Unrelated complaint → None (low confidence, LLM decides)",
    result is None,
    f"Got: {result}"))

# Very short message
result = asyncio.run(classify_complaint("help", CATEGORIES))
t4.append(check("Very short message → None or category (no crash)",
    True))  # just checking no exception

print(f"\nTest 4: {sum(t4)}/{len(t4)}\n")


# FINAL REPORT
all_r  = t1 + t2 + t3 + t4
passed = sum(all_r)
total  = len(all_r)

print("="*60)
print("FINAL REPORT — Option A Language-Gated Classifier")
print("="*60)
print(f"  Test 1 — Language detection:      {sum(t1)}/{len(t1)}")
print(f"  Test 2 — English classification:  {sum(t2)}/{len(t2)} ({100*sum(t2)//len(t2)}%)")
print(f"  Test 3 — Arabic → deferred:       {sum(t3)}/{len(t3)} (must all be None)")
print(f"  Test 4 — Edge cases:              {sum(t4)}/{len(t4)}")
print(f"\n  TOTAL: {passed}/{total} ({100*passed//total}%)")

if passed == total:
    print("\n  ✅ All tests passed — Option A ready for integration into chat.py")
elif passed >= total * 0.85:
    print("\n  ⚠️  Most tests passed — check failures then integrate")
else:
    print("\n  ❌ Failures — review before integrating")
print("="*60)

print("""
WHAT THIS MEANS FOR THE SYSTEM:
  English complaints → semantic classifier handles them
    - HIGH confidence (sim > 0.62) → category assigned, ZERO LLM call for categorization
    - MEDIUM confidence → LLM picks from top-3 only (short prompt, cheap)
    - LOW confidence → LLM decides from full list (same as before)
  Arabic complaints → return None → LLM decides as before (no change to Arabic behavior)
  
  Net result: roughly 60-70% of English complaints save one LLM call.
  Arabic users: identical behavior to current system.
""")