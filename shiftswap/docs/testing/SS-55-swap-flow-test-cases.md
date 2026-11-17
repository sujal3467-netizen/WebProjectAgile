
# SS-55 — Swap Flow Test Cases

**Project:** ShiftSwap  
**Tester:** Bikram  
**Status:** Test cases prepared — results pending

## Test setup

- Run ShiftSwap locally using Deno.
- Have two employee accounts and one manager account available.
- Use future shifts for the normal swap tests.
- Record actual results after each test.
- Create a Jira Bug ticket for any failed test.

## A. Successful swap flows

| ID | Test | Steps | Expected result | Status |
|---|---|---|---|---|
| TC-01 | Offer shift | Employee A offers a future shift | Swap request created with pending status | Not run |
| TC-02 | Accept swap | Employee B accepts the available swap | Status changes to accepted; notifications created | Not run |
| TC-03 | Approve swap | Manager approves an accepted swap | Shift transferred to Employee B; both employees notified | Not run |
| TC-04 | Reject swap | Manager rejects a different accepted swap | Original employee keeps the shift; both employees notified | Not run |

## B. Error test cases (README)

| ID | Situation | Expected HTTP status | Expected result | Status |
|---|---|---|---|---|
| TC-05 | Offer another employee's shift | 403 | You can only swap your own shifts | Not run |
| TC-06 | Offer a past shift | 400 | You can only swap shifts that haven't happened yet | Not run |
| TC-07 | Offer a shift with an existing swap request | 400 | This shift already has a swap request | Not run |
| TC-08 | Offer a shift to yourself or a manager | 400 | Invalid recipient | Not run |
| TC-09 | Accept your own swap | 400 | You can't accept your own swap | Not run |
| TC-10 | Accept an unavailable swap | 400 | This swap is no longer available | Not run |
| TC-11 | Accept a swap offered to someone else | 403 | This swap was offered to someone else | Not run |
| TC-12 | Approve/reject before acceptance | 400 | Only accepted swaps can be approved or rejected | Not run |
| TC-13 | Approve/reject an already decided swap | 400 | This swap has already been decided | Not run |
| TC-14 | Accept a swap for a past shift | 400 | This shift has already happened | Not run |
| TC-15 | Manager attempts employee-only action | 403 | Only employees can do this | Not run |
| TC-16 | Employee attempts manager-only action | 403 | Only managers can do this | Not run |

## C. Notification test cases

| ID | Test | Expected result | Status |
|---|---|---|---|
| TC-17 | Offer a shift to a colleague | Colleague receives a notification | Not run |
| TC-18 | Accept a swap | Original employee and managers receive notifications | Not run |
| TC-19 | Manager approves swap | Both employees receive notifications | Not run |
| TC-20 | Manager rejects swap | Both employees receive notifications | Not run |

## D. Test execution summary

**Total test cases:** 20  
**Passed:** 0 confirmed  
**Failed:** 0 confirmed  
**Not run:** 20  

Update these numbers after executing the tests.

## E. Bug reporting

If a test fails, create a Jira Bug ticket including:

- Test case ID
- Steps to reproduce
- Expected result
- Actual result
- Screenshot or error message
- Related task: SS-55

## Conclusion

These test cases cover the ShiftSwap offer, accept, approve and reject flows, the README error scenarios, and related notifications.

Actual test results must be recorded before the testing task can be considered verified.
