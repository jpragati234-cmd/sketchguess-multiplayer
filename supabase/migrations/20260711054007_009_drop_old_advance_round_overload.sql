/*
# Drop old advance_round(uuid, text) overload

The old advance_round accepted a word parameter from the client. The new
version (migration 008) picks words from the server-side word_list. Having
both overloads causes ambiguity. Drop the old one.
*/

DROP FUNCTION IF EXISTS advance_round(uuid, text);