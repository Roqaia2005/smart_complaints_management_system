import asyncio, sys
sys.path.insert(0, ".")

P = "\033[92mPASS\033[0m"
F = "\033[91mFAIL\033[0m"

def check(label, condition, detail=""):
    tag  = P if condition else F
    line = f"  {tag} | {label}"
    if detail: line += f"\n         {detail}"
    print(line)
    return condition

async def run():
    from routers.suggest import suggest_category_description, SuggestRequest

    all_results = []

    print("=" * 60)
    print("TEST 1 — Basic suggestion for Labs category")
    print("=" * 60)
    t1 = []
    r = await suggest_category_description(SuggestRequest(
        name="Labs", existing_description="equipment issues"
    ))
    print(f"\n  success: {r.get('success')}")
    if r.get("success"):
        s = r["suggestion"]
        print(f"  EN:   {s.get('description_en', '')[:90]}")
        print(f"  AR:   {s.get('description_ar', '')[:90]}")
        print(f"  kw_en: {s.get('keywords_en', [])}")
        print(f"  kw_ar: {s.get('keywords_ar', [])}")

    t1.append(check("success=True",           r.get("success") == True))
    t1.append(check("has description_en",     bool(r.get("suggestion", {}).get("description_en"))))
    t1.append(check("has description_ar",     bool(r.get("suggestion", {}).get("description_ar"))))
    t1.append(check("keywords_en is list",    isinstance(r.get("suggestion", {}).get("keywords_en"), list)))
    t1.append(check("keywords_ar is list",    isinstance(r.get("suggestion", {}).get("keywords_ar"), list)))
    t1.append(check("has combined_description", bool(r.get("suggestion", {}).get("combined_description"))))
    t1.append(check("has combined_keywords",  bool(r.get("suggestion", {}).get("combined_keywords"))))
    t1.append(check("EN keywords not empty",  len(r.get("suggestion", {}).get("keywords_en", [])) > 0))
    t1.append(check("AR keywords not empty",  len(r.get("suggestion", {}).get("keywords_ar", [])) > 0))
    print(f"\nTest 1: {sum(t1)}/{len(t1)}\n")
    all_results += t1

    print("=" * 60)
    print("TEST 2 — Suggestions for all three common categories")
    print("=" * 60)
    t2 = []
    for name in ["Examinations", "Registration", "Student Affairs"]:
        r2 = await suggest_category_description(SuggestRequest(name=name))
        ok = r2.get("success") == True
        t2.append(ok)
        if ok:
            s2 = r2["suggestion"]
            print(f"\n  {name}:")
            print(f"    EN: {s2.get('description_en','')[:80]}")
            print(f"    AR: {s2.get('description_ar','')[:80]}")
        check(f"{name} suggestion succeeds", ok)
    print(f"\nTest 2: {sum(t2)}/{len(t2)}\n")
    all_results += t2

    print("=" * 60)
    print("TEST 3 — Edge cases")
    print("=" * 60)
    t3 = []

    # Empty name should return error gracefully
    r3 = await suggest_category_description(SuggestRequest(name=""))
    t3.append(check("Empty name → success=False gracefully",
        r3.get("success") == False,
        f"Got: {r3}"))

    # Whitespace only name
    r4 = await suggest_category_description(SuggestRequest(name="   "))
    t3.append(check("Whitespace name → success=False gracefully",
        r4.get("success") == False,
        f"Got: {r4}"))

    # Arabic category name
    r5 = await suggest_category_description(SuggestRequest(name="الامتحانات"))
    t3.append(check("Arabic name works",
        r5.get("success") == True,
        f"Got: {r5.get('success')}"))

    print(f"\nTest 3: {sum(t3)}/{len(t3)}\n")
    all_results += t3

    print("=" * 60)
    print("TEST 4 — Embedding quality improvement check")
    print("=" * 60)
    t4 = []

    from services.embedding_service import get_embedding_service, EmbeddingService

    svc = get_embedding_service()

    r6 = await suggest_category_description(SuggestRequest(name="Labs"))
    if r6.get("success"):
        s6 = r6["suggestion"]

        # Category with AI suggestion
        ai_text = EmbeddingService.build_category_text(
            name="Labs",
            description=s6["combined_description"],
            keywords=s6["keywords_en"] + s6["keywords_ar"],
        )
        # Category with minimal description
        minimal_text = EmbeddingService.build_category_text(
            name="Labs",
            description="equipment problems",
            keywords=["lab", "broken"],
        )

        v_ai      = svc.encode(ai_text)
        v_minimal = svc.encode(minimal_text)
        v_complaint = svc.encode("the AC is broken in lab 10 since last Monday")

        sim_ai      = svc.cosine_similarity(v_complaint, v_ai)
        sim_minimal = svc.cosine_similarity(v_complaint, v_minimal)

        print(f"\n  English complaint vs AI description:      {sim_ai:.3f}")
        print(f"  English complaint vs minimal description: {sim_minimal:.3f}")
        print(f"  Improvement: {'+' if sim_ai >= sim_minimal else ''}{(sim_ai-sim_minimal):.3f}")

        t4.append(check("AI embedding is valid 384-dim vector", len(v_ai) == 384))
        t4.append(check("AI similarity is measurable",           sim_ai > 0.4))
        t4.append(check("AI >= minimal similarity",              sim_ai >= sim_minimal,
            f"AI={sim_ai:.3f} minimal={sim_minimal:.3f}"))
    else:
        t4.append(check("Suggestion for embedding test succeeded", False,
            "Skipped — suggestion call failed"))

    print(f"\nTest 4: {sum(t4)}/{len(t4)}\n")
    all_results += t4

    passed = sum(all_results)
    total  = len(all_results)
    print("=" * 60)
    print("FINAL REPORT")
    print("=" * 60)
    print(f"  Test 1 — Basic suggestion:        {sum(t1)}/{len(t1)}")
    print(f"  Test 2 — Multiple categories:     {sum(t2)}/{len(t2)}")
    print(f"  Test 3 — Edge cases:              {sum(t3)}/{len(t3)}")
    print(f"  Test 4 — Embedding improvement:   {sum(t4)}/{len(t4)}")
    print(f"\n  TOTAL: {passed}/{total} ({100*passed//total if total else 0}%)")
    if passed == total:
        print("\n  ✅ All passed — register router in main.py and tell frontend")
    else:
        print("\n  ⚠️  Check failures above")
    print("=" * 60)

    print("""
CURL TESTS (run while service is running):

1. Basic test:
curl -X POST http://localhost:8000/api/admin/categories/suggest-description \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Labs", "existing_description": "equipment issues"}'

2. Empty description:
curl -X POST http://localhost:8000/api/admin/categories/suggest-description \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Examinations", "existing_description": ""}'

3. Error case:
curl -X POST http://localhost:8000/api/admin/categories/suggest-description \\
  -H "Content-Type: application/json" \\
  -d '{"name": "", "existing_description": ""}'
""")

asyncio.run(run())