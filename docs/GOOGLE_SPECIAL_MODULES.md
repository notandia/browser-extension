# Google generated and expandable search modules

Notandia treats Google search modules as containers of evidence rather than publications.

## AI Overview

The whole AI-generated answer must never inherit a publisher match merely because one cited source matches a watchlist profile. Notandia evaluates visible source cards and inline source links independently. Expanding an AI Overview can add new source nodes dynamically; the publisher scanner observes those additions and rescans the relevant source units.

## People Also Ask

The whole People Also Ask / FAQ block must never inherit a publisher match from one answer. Each `.related-question-pair` is evaluated independently so expansion can reveal and classify the sources associated with that question without styling unrelated questions.

## Rationale

A publisher match describes the linked scholarly source, not Google's generated prose, the search feature itself, or neighboring sources. Source-level handling prevents misleading whole-module highlighting and inflated popup counts.
