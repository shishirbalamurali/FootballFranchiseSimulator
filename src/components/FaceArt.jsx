import { useMemo } from 'react';
import { Face } from 'facesjs/react';
import { faceFor, faceOverrides } from './faces';

// The facesjs drawing itself. Kept in its own module so PlayerFace can load it
// lazily: the face artwork is ~350 KB and nothing on the first screen needs it.
export default function FaceArt({ playerId, age, team, teamId, lazy, style }) {
  const face = useMemo(() => faceFor(playerId), [playerId]);
  // Face re-draws whenever `overrides` changes identity, so it must be memoised.
  const overrides = useMemo(
    () => faceOverrides(face, { age, team, teamId }),
    [face, age, team, teamId],
  );
  return <Face face={face} overrides={overrides} lazy={lazy} ignoreDisplayErrors style={style} />;
}
