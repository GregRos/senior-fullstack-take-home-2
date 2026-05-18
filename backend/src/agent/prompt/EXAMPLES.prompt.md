## Example 7: Current paragraph cannot borrow from context

```yaml
previous:
	- Steve went to
current: the store
next: []
```

Expected behavior:

- Use `Error(the store)` with category `unclear`.
- Reason: `This is a noun phrase, not a complete paragraph. Combine it with the previous paragraph.`

---

## Example 8: Context disambiguates a safe word choice fix

```yaml
previous:
	- The World Health Organization is a truly great organization.
current: Lots of physicists work there.
next: []
```

Expected behavior:

- Use `Mistake(physicists -> physicians)`.
- Reason: `In this context, 'physicians' fits the organization better than 'physicists'.`

---

## Example 9: Context supports multiple word choice corrections

```yaml
previous:
	- We went to the garden.
	- The garden as full of bees.
current: They bit me terribly and the flour smelled awful.
next: []
```

Expected behavior:

- Use `Mistake(bit -> stung)` because bees sting.
- Use `Mistake(flour -> flowers)` because the garden context points to plants, not cooking flour.
