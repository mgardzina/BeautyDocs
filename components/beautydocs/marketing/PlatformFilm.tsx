"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";

export interface PlatformFilmChapter {
  readonly start: number;
  readonly title: string;
  readonly description: string;
}

interface PlatformFilmProps {
  readonly src: string;
  readonly poster: string;
  readonly label: string;
  readonly frame: "window" | "phone";
  readonly address?: string;
  readonly chapters?: readonly PlatformFilmChapter[];
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * A real screen recording of the product. Plays muted only while visible,
 * never autoplays for people who asked for reduced motion, and can always be
 * paused. Chapters seek the film and show continuous progress.
 */
export function PlatformFilm({ src, poster, label, frame, address, chapters }: PlatformFilmProps) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Autoplay only on screen, only when motion is welcome and the viewer hasn't paused it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion || userPaused) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reducedMotion, userPaused]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      void video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  }, []);

  const seek = (start: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = start;
    setTime(start);
    // On narrow layouts the chapter list sits below the film: bring the film back into view.
    const rect = video.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      video.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    }
    setUserPaused(false);
    void video.play().catch(() => {});
  };

  const activeIndex = chapters
    ? chapters.reduce((active, chapter, index) => (time >= chapter.start ? index : active), 0)
    : -1;

  const film = (
    <div className={frame === "phone" ? "bd-film-phone" : "bd-film-window"}>
      {frame === "window" ? (
        <div aria-hidden="true" className="bd-film-chrome">
          <span /><span /><span />
          {address ? <p>{address}</p> : null}
        </div>
      ) : null}
      <div className="bd-film-screen">
        <video
          aria-label={label}
          loop
          muted
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          playsInline
          poster={poster}
          preload="metadata"
          ref={videoRef}
          src={src}
        />
        <button
          aria-label={playing ? t("Zatrzymaj film") : t("Odtwórz film")}
          className={`bd-film-toggle ${playing ? "" : "is-paused"}`}
          onClick={toggle}
          type="button"
        >
          {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={18} />}
        </button>
      </div>
    </div>
  );

  if (!chapters) return film;

  return (
    <div className="bd-film-chaptered">
      {film}
      <ol className="bd-film-chapters">
        {chapters.map((chapter, index) => {
          const end = chapters[index + 1]?.start ?? duration;
          const progress =
            index < activeIndex ? 1 : index > activeIndex || end <= chapter.start ? 0 : (time - chapter.start) / (end - chapter.start);
          return (
            <li key={chapter.start}>
              <button
                aria-current={index === activeIndex ? "step" : undefined}
                className={index === activeIndex ? "is-active" : ""}
                onClick={() => seek(chapter.start)}
                type="button"
              >
                <span className="bd-film-chapter-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="bd-film-chapter-copy">
                  <strong>{chapter.title}</strong>
                  <small>{chapter.description}</small>
                </span>
                <span aria-hidden="true" className="bd-film-chapter-progress">
                  <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
