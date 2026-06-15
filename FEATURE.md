/goal When a name is submitted, we need to submit a prompt to `openai('gpt-5.5')` with the `web_search` tool enabled and attempt to find the net worth of the that person.

Requirements:

- When the name is submitted, show a loading spinner instead of the submit icon
- The backend should ideally return to the frontend `name`, `estimated_net_worth`, and `sources`. This is the happy path.
- Once the data is received on the frontend, it should replace the text input and buttons with an info box
- The info box should have a dashed outline and take up the same amount of space as what is reserved by the scale key when it is visible. This is to prevent layout shift in surrounding elements.
- The info box should have the content shown below
- The info box should have a small "Reset" button that brings back the scale key and "Visualize..." text.
- When the data is received, the zoomable grid should
  - Draw a new box on the grid. The box should be drawn with a medium-thick dashed border and it should not have any fill of it's own.
  - Slowly animate from the current zoom-level to the almost zoom-level of the new dashed box. For reference, the almost zoom-level for $1M is 645x. For $1B, it is 20x.
  - If the estimated net worth is below $1M, then skip this part.

Info Box - When we have data

```
Jeff Bezos has an approximate net worth of $250 billion.
Sources: Wikipedia, Forbes
```

Info Box - When gpt-5.5 couldn't find any data

```
Unable to find publicly available net worth data for Jeff Minkowski.
```

Info Box - When the provided name is too generic and ambiguous

```
It's unclear which Tom Holland you are referring to. Try again using a qualifier, e.g. "Jeff Bridges, the actor"
```

Additional Notes:

- Use the Vercel AI SDK and the `openai()` provider
- Utilize AI SDK structured outputs
