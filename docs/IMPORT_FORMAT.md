# Contact import

Every spreadsheet row is imported. Nothing is skipped, including rows whose name starts with EXAMPLE. A completely empty row is not a row. A row with no name is saved as Unnamed contact.

One row is one visit. The same person can have several rows. A row is merged as an extra visit only when the name matches and the phone or the email matches, and the Visited value is different. Every other row becomes its own contact. An exact duplicate row is still added and flagged as a possible duplicate.

## Header

Use these names, in this order:

```
name,phone,email,address,city,state,zip,tags,visited,status,reaction,notes,visit_date
```

A file with that exact header is imported without column matching. An older file that still has `share_with_cora` in place of `tags`, `status`, and the new order is imported too. Any other header can still be matched on the Import screen. `.csv` and `.xlsx` are both accepted.

## Allowed values

- `visited`: `Summer 5786`, `Chanukah 5787`, or any other short label. Blank is allowed.
- `status`: `Completed` or `Deferred`. Blank, or a value that is neither, is saved as Completed.
- `visit_date`: `YYYY-MM-DD`, or blank.
- `reaction`: `Very happy`, `Warm`, `Neutral`, `Cold`, or `Very cold / angry`. Neutral is “nisht ahin nisht aher”.
- `tags`: `Not Jewish`, `Probably doesn't exist`, or both, separated by a comma or a semicolon. Matching ignores capitalization.
- `state`: `Maine`, `Wisconsin`, `New Hampshire`, or `Unsorted`. A 2-letter code (`ME`, `WI`, `NH`) or the full name is fine. `Unsorted` is for a contact that is not in one of those three states. A blank state is still imported.
- `phone`: digits, with or without dashes or parentheses.
- `email`: a bad address is a warning and is left blank.

Sharing is the app default: a Cora admin import is shared, and a shliach import uses the Share with Cora switch on the Import screen. A column named `share_with_cora` in an older file still overrides that row.

The summary is `rows read = contacts created + visits merged`. A row that fails to save is listed. It is not dropped quietly.

## Prompt for another model

The Import screen has a copy button for the instructions another model should follow. The template’s two rows are the same sample contact, once for Summer 5786 and once for Chanukah 5787.
