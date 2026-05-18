Change occurences of bare strings to passing objects with e.g. `type: plain` and a similar structure to other objects.

The reason field should include instruction on how long it should be and the tone to use. It's the only free text field in the schema.

The examples should be encoded as message history. Just create an appropriate Modeled object and serialize it to JSON, don't hand-write JSON data.

put the system prompt into another file

combine the two into a submodule

---

Change the agent input type to have two properties:

1. input
2. context

Context should be of the form:

```yaml
position: before | after
text: (text)
```
