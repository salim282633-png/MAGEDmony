# Security Specification for Finance App

## Data Invariants
1. A budget item must belong to a user and have a valid month format (YYYY-MM).
2. Daily expenses must have a valid category from the defined list.
3. Users can only read and write their own data.
4. Total savings and emergency fund actual amounts cannot be negative.
5. Debt status must be one of the pre-defined Arabic statuses.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a budget item with a different `userId`.
2. **Ghost Field**: Attempt to add `isAdmin: true` to a user setting document.
3. **Negative Amount**: Attempt to log an expense with a negative amount.
4. **Invalid Category**: Attempt to log an expense with category "Luxury" (not in list).
5. **Orphaned Budget**: Create a budget item without a `userId`.
6. **Future Debt**: Set a debt status to "Future" (not in enum).
7. **Cross-User Read**: Attempt to read someone else's `settings` document.
8. **PII Leak**: Attempt to list all `settings` without a filter.
9. **Large Payload**: Attempt to send a 2MB string in the `notes` field.
10. **State Shortcut**: Change a task status from "لم يبدأ" to "مكتمل" without going through "جاري التنفيذ" (if we enforced state transitions, but here we just check for valid enum).
11. **Malicious ID**: Using a very long string as a document ID.
12. **Unauthorized Settings Update**: Changing another user's salary.

## Test Runner (Draft Logic)
The `firestore.rules` will ensure `request.auth.uid == resource.data.userId` for all access.
Each entity will have an `isValid[Entity]` function.
