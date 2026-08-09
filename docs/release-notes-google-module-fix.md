# Google search module regression fix

This change prevents composite Google search modules from being attributed to a publisher because one nested source matches a watchlist profile. AI Overview sources and People Also Ask questions are evaluated as individual context units, including content inserted after expansion. It also keeps new general-purpose runtime APIs on the Notandia namespace while retaining explicit aliases required for in-place upgrade compatibility.
