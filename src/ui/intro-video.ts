/** the intro video has played this page load; a hard refresh starts over */
let played = false;

/** how long before the end the video starts fading out and the round begins underneath it */
export const INTRO_FADE_SECONDS = 3;

/**
 * Play the intro video full screen, then call `begin`. It plays once per page load, so later calls
 * (a new run, or Start again after quitting to the title) go straight to `begin(false)`.
 *
 * `begin(true)` comes INTRO_FADE_SECONDS before the video ends, while the picture and its sound fade
 * out, so the round and its music fade in as the video ends. Skipping, or a video that cannot play,
 * begins at once with `begin(false)` (no fade), and a video never holds the game up.
 */
export function playIntroVideo(parent: HTMLElement, url: string, begin: (fadeIn: boolean) => void): void {
  if (played) {
    begin(false);
    return;
  }
  played = true;
  const overlay = document.createElement('div');
  overlay.className = 'intro-video';
  overlay.innerHTML = `<video playsinline preload="auto" src="${url}"></video><button type="button" class="btn intro-skip">Skip</button>`;
  const video = overlay.querySelector('video') as HTMLVideoElement;
  let begun = false;
  let removed = false;
  const start = (fadeIn: boolean): void => {
    if (begun) return;
    begun = true;
    begin(fadeIn);
  };
  const remove = (): void => {
    if (removed) return;
    removed = true;
    video.pause();
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const skip = (): void => {
    start(false);
    remove();
  };
  video.addEventListener('timeupdate', () => {
    const left = video.duration - video.currentTime;
    if (!(left <= INTRO_FADE_SECONDS) || removed) return;
    overlay.classList.add('fading');
    video.volume = Math.max(0, Math.min(1, left / INTRO_FADE_SECONDS));
    start(true);
  });
  video.addEventListener('ended', skip);
  video.addEventListener('error', skip);
  overlay.querySelector('.intro-skip')?.addEventListener('click', skip);
  // Space, Enter or Escape also skip, and no other key reaches the game underneath
  function onKey(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') skip();
  }
  window.addEventListener('keydown', onKey, true);
  parent.appendChild(overlay);
  video.play().catch(skip);
}

/**
 * Play a clip full screen over the game and call `done` when it ends or is skipped (Skip, Space,
 * Enter or Escape). Unlike the intro it can play any number of times, and it does not fade. A clip
 * that cannot play calls `done` at once, so the game is never held up.
 */
export function playClip(parent: HTMLElement, url: string, done: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'intro-video';
  overlay.innerHTML = `<video playsinline preload="auto" src="${url}"></video><button type="button" class="btn intro-skip">Skip</button>`;
  const video = overlay.querySelector('video') as HTMLVideoElement;
  let finished = false;
  function onKey(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') finish();
  }
  function finish(): void {
    if (finished) return;
    finished = true;
    video.pause();
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
    done();
  }
  video.addEventListener('ended', finish);
  video.addEventListener('error', finish);
  overlay.querySelector('.intro-skip')?.addEventListener('click', finish);
  window.addEventListener('keydown', onKey, true);
  parent.appendChild(overlay);
  video.play().catch(finish);
}
