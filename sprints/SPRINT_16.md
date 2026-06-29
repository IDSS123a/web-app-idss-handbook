# SPRINT_16 — IDSS Asistent Chatbot
# IDSS Handbook Web Application
# Date: 2026-06-28

---

## Goal

Build the complete IDSS Asistent chatbot. 10-step RAG pipeline.
Answers grounded questions confidently. Refuses ungrounded ones gracefully.

---

## Scope — IN

Full 10-step pipeline from CONSTITUTION.md O-8:
1. Validate message (not empty, max 2,000 chars)
2. Rate limit: 20 messages/user/hour via Upstash Redis
3. Embed query: `text-embedding-004`, task RETRIEVAL_QUERY
4. Hybrid retrieval: pgvector cosine + tsvector full-text, active chunks only
5. Filter: top 5 chunks above cosine 0.6
6. Confidence: HIGH if any chunk ≥ 0.75, else LOW
7. LOW confidence → exact Bosnian refusal message (no generation call)
8. HIGH confidence → generate with system prompt, max_tokens 1024, temp 0.3
9. Store full conversation turn in DB
10. Return response to UI

## Scope — OUT

- Super Admin conversation viewer (Sprint 19)

---

## Acceptance Criteria

- [ ] User can send messages in chatbot interface
- [ ] Query embedded with `text-embedding-004`, task type `RETRIEVAL_QUERY`
- [ ] Retrieval filters `document_status = 'active'` only
- [ ] Hybrid search: 70% cosine + 30% full-text weighting
- [ ] Elaborat chunks ranked first in result set regardless of score
- [ ] HIGH confidence (≥ 0.75): answer generated and returned
- [ ] LOW confidence: exact message returned:
      "Za ovo pitanje nemam dovoljno pouzdanih informacija iz internih dokumenata škole.
       Molim Vas da se obratite direktoru škole."
      (no gemini call made — verify in logs)
- [ ] Rate limit: 21st message in same hour returns Bosnian rate limit message
- [ ] Every turn stored: user_id, message, chunk_ids, similarity scores,
      confidence, response, timestamp, key_index, tokens_used
- [ ] Chatbot never responds in any language other than Bosnian
- [ ] Chatbot never mentions modifying institutional documents
- [ ] `npx tsc --noEmit` passes

---

## System Prompt (exact — do not modify)

```
Ti si IDSS Asistent, profesionalni institucionalni asistent za nastavnike i zaposlenike
P.U. Internationale Deutsche Schule Sarajevo.

Odgovaraš isključivo na bosanskom jeziku, bez iznimke.
Tvoji odgovori su precizni, profesionalni i direktni.
Nikada ne koristiš fraze poput "naravno", "svakako", "sjajno pitanje", "razumijem" ili slične.

Sve informacije moraju biti zasnovane isključivo na dokumentima USTAV-a:
[CONTEXT: {retrieved_chunks}]

Ako informacija nije direktno podržana dokumentima, ne izmišljaj. Uputi korisnika direktoru.
```

---

## Files Expected to Change

- `lib/rag/retriever.ts`
- `features/chatbot/pipeline.ts`
- `features/chatbot/repository.ts`
- `features/chatbot/actions.ts`
- `features/chatbot/components/ChatInterface.tsx`
- `features/chatbot/components/ChatMessage.tsx`
- `app/(dashboard)/chatbot/page.tsx`
- `app/api/chatbot/message/route.ts`

---

## Done Checklist Reference

https://raw.githubusercontent.com/IDSS123a/commander/main/DONE_CHECKLIST.md
