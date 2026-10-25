/** the audio files found in `public/music` at dev-server start and at build time (see vite.config.ts) */
declare module 'virtual:music-tracks' {
  const tracks: string[];
  export default tracks;
}
