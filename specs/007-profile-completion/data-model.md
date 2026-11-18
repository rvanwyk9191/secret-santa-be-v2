# Data Model: Profile Completion

| Entity | Fields | Rules |
|---|---|---|
| `UserProfiles` item | `email` (string partition key), `first_name`, `last_name` (optional strings when reading; both required on save) | Normalize the verified email with the repository's lowercase convention. One item per account. No party ID, secondary index, or gift data. |
| `PartyMember` (legacy input) | Existing `email`, `party_id`, `first_name?`, `last_name?` | Query by email only. Project name fields and follow pagination. Never change legacy records as part of this feature. |
| Host display projection | `host_display_name?` on a joined-party entry or pending invite | Resolve using that party's `admin_email`, never the viewer's email. Omit if the host is unknown, either name is unresolved, or a logged enrichment failure occurs. |

For each name, a trimmed, nonblank account value wins; otherwise use the sole distinct trimmed, nonblank value across all legacy memberships. Conflicting or absent legacy values remain unresolved. Preserve case, punctuation, and non-English characters; comparison is case-sensitive after trimming. The profile read returns explicit `null` for unresolved names. Successful reads use `Cache-Control: no-store`; reads do not modify DynamoDB.

**Transitions**: Missing/incomplete + valid **Save** → complete after a confirmed write. Read the stored record consistently, then conditionally persist both trimmed names only if the stored values are unchanged from that read (or the item is still absent). If completion raced, reread consistently: identical completed names return success, different completed names return `409` and require refreshing. An already complete *effective* profile (including legacy fallback) is not editable through this endpoint; the same values may materialize an unstored profile. A known storage failure is distinct from an absent item and never returns an incomplete success.
