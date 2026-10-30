# Round-change song prompt for Gemini

A second song in the style of the intro, "The Kingdom Underneath". It plays in the gap when one round
ends and the next begins. Same mock-heroic epic: a dramatic narrator, a big orchestra and a choir,
all deadly serious about a mold on the forest floor.

Paste the whole block below into Gemini (Lyria / music generation). Ask for 4 or 5 takes.

## Prompt

> Create a short epic cinematic piece, about 40 to 50 seconds long, called "The Spores Return".
> It is the interlude between two rounds of a game about a slime mold spreading across a forest floor.
> It must feel like the sequel to a grand fantasy film score, performed with total, deadly seriousness
> about something ridiculous: a mold.
>
> **Sound:** a full cinematic orchestra (strings, low brass, french horns, timpani, harp) and a large
> choir singing long "ahh" and "ooh" notes. Same epic, over-the-top mood as the intro song. No modern
> instruments, no drums kit, no electronic sounds, no sound effects, no applause.
>
> **Voice:** one deep, rich, theatrical narrator speaking (not singing) the lines slowly and clearly,
> from a hushed whisper to a booming shout. Voice clear and in front, orchestra quieter under it.
> Every word must be easy to make out.
>
> **Structure:**
> 1. 0 to 12s: the round ends. Slow, hushed, low strings and a distant choir, a little wistful.
>    The narrator: "The battle is over... the fields lie quiet... and beneath the leaves, the mold rests."
> 2. 12 to 22s: a long pause, a single soft harp note, then the music begins to stir. Timpani
>    rolls start to build and the strings rise.
>    The narrator, growing warmer: "But the spores... the spores remember."
> 3. 22 to 40s: the turn to hope. Brass enters, the choir swells, the key lifts to major.
>    The narrator, building to a shout: "Rise, little mold! The forest floor awaits! Spread... and
>    spread... AGAIN!"
> 4. 40 to 50s: a huge triumphant orchestra and choir hit on "AGAIN!", a brass flourish, then a final
>    held chord that fades out completely. No abrupt cut, no trailing silence longer than half a second.
>
> Mood arc: calm and a little sad, then stirring, then triumphant and thrilling. Spoken word only, the
> voice never sings. It should clearly sound like a sibling of the intro song, but shorter and more
> hopeful.

## Tips

- If it does not feel like the intro, paste the intro's original prompt and lyrics at the top and say
  "same style, voice and orchestra as the previous piece".
- If Gemini starts singing the words, add "spoken word only, the voice never sings".
- If it runs long, ask for "exactly 45 seconds"; the game can fade it out, but a clean ending is better.
- Normalise the loudness to match the intro and the doom stings after generating.
- Save as mp3 in `public/operas/`, for example `public/operas/The_Spores_Return.mp3`. Tell me the
  filename and I will wire it up to play between rounds, behind the Embellishments option like the
  intro.
