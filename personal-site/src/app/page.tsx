"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { ProfileImage } from "@/components/profile-image";
import { AnimatedTitle } from "@/components/animated-title";
import { Footer } from "@/components/footer";

type Section = "home" | "projects" | "links";

const NAV_ITEMS: { key: string; section: Section }[] = [
  { key: "h", section: "home" },
  { key: "p", section: "projects" },
  { key: "l", section: "links" },
];

const SECTION_TITLES: Record<Section, string> = {
  home: "vitor",
  projects: "projects",
  links: "links",
};

const WORK_HISTORY = [
  {
    company: "Meetkai",
    role: "Lead Software Engineer",
    period: "2025 - present",
  },
  { company: "Meetkai", role: "Software Engineer", period: "2023 - 2024" },
  { company: "Outsmart", role: "Full Stack Engineer", period: "2022 - 2023" },
  { company: "Avenue Code", role: "Frontend Engineer", period: "2021 - 2022" },
  { company: "Shark Tratores", role: "System Analyst", period: "2019 - 2020" },
];

const PROJECTS = [
  {
    name: "Super Gen Pass",
    description: "My own password manager using a hashing algorithm.",
    tech: ["React", "Next.js", "TypeScript"],
    link: "https://github.com/vitor-hbr/super-gen-pass",
  },
];

const LINKS = [
  {
    label: "github",
    href: "https://github.com/vitor-hbr",
    display: "vitor-hbr",
  },
  {
    label: "linkedin",
    href: "https://www.linkedin.com/in/vitor-hbr/",
    display: "in/vitor-hbr",
  },
  {
    label: "email",
    href: "mailto:vitor.hbr@outlook.com",
    display: "vitor.hbr@outlook.com",
  },
];

function scrollToSection(section: Section) {
  const element = document.getElementById(section);
  if (element) {
    element.scrollIntoView({ behavior: "auto", block: "start" });
  }
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [animationKeys, setAnimationKeys] = useState<Record<Section, number>>({
    home: 0,
    projects: 0,
    links: 0,
  });
  const sectionRefs = useRef<Record<Section, HTMLElement | null>>({
    home: null,
    projects: null,
    links: null,
  });

  const navigateToSection = useCallback((section: Section) => {
    setAnimationKeys((keys) => ({
      ...keys,
      [section]: keys[section] + 1,
    }));
    scrollToSection(section);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const item = NAV_ITEMS.find((item) => item.key === e.key.toLowerCase());
      if (item) {
        navigateToSection(item.section);
      }
    },
    [navigateToSection]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Intersection Observer to track active section
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const sections: Section[] = ["home", "projects", "links"];
    sections.forEach((section) => {
      const element = sectionRefs.current[section];
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(section);
            }
          });
        },
        { threshold: 0.3, rootMargin: "-10% 0px -60% 0px" }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 100) {
        setActiveSection("home");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 max-w-2xl mx-auto">
      <nav
        className="flex gap-6 text-sm sticky top-0 bg-background/80 backdrop-blur-sm py-4 -mt-4 z-10"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.section;
          return (
            <button
              key={item.key}
              onClick={() => navigateToSection(item.section)}
              className={`transition-colors ${
                isActive ? "text-accent" : "text-muted hover:text-accent"
              }`}
            >
              <span className={isActive ? "text-accent/60" : "text-muted"}>
                [{item.key}]
              </span>{" "}
              {item.section}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 py-12">
        {/* Home Section */}
        <section
          id="home"
          ref={(el) => {
            sectionRefs.current.home = el;
          }}
          className="scroll-mt-16 mb-24"
        >
          <div className="flex flex-col sm:flex-row gap-8 items-start mb-12">
            <ProfileImage />
            <div className="flex flex-col gap-4">
              <h1 className="text-3xl">
                <AnimatedTitle
                  key={`home-${animationKeys.home}`}
                  text={SECTION_TITLES.home}
                />
              </h1>
              <p className="text-muted leading-relaxed">
                full stack engineer specializing in react and next.js.
                passionate about performance optimization, 3D/WebGL, and
                AI-augmented development.
              </p>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-sm text-muted mb-4">work</h2>
            <ul className="space-y-1">
              {WORK_HISTORY.map((job, index) => (
                <li
                  key={`${job.company}-${index}`}
                  className="flex justify-between py-2 -mx-2 px-2 rounded transition-colors hover:bg-accent/10 cursor-default"
                >
                  <div>
                    <span>{job.role}</span>
                    <span className="text-muted"> @ {job.company}</span>
                  </div>
                  <span className="text-muted text-sm">{job.period}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm text-muted mb-4">about</h2>
            <p className="text-muted leading-relaxed">
              6 years building for the web. i focus on making things fast and
              delightful. currently leading engineering at meetkai, working on
              next.js performance and AI tooling integration.
            </p>
          </div>
        </section>

        {/* Projects Section */}
        <section
          id="projects"
          ref={(el) => {
            sectionRefs.current.projects = el;
          }}
          className="scroll-mt-16 mb-24"
        >
          <h2 className="text-3xl mb-8">
            <AnimatedTitle
              key={`projects-${animationKeys.projects}`}
              text={SECTION_TITLES.projects}
            />
          </h2>
          <div className="space-y-6">
            {PROJECTS.map((project) => (
              <a
                key={project.name}
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <article className="border border-muted/20 rounded-lg p-4 transition-all hover:border-accent/50 hover:bg-accent/5">
                  <h3 className="text-lg group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-muted mt-2 text-sm">
                    {project.description}
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {project.tech.map((t) => (
                      <span
                        key={t}
                        className="text-xs text-muted bg-muted/10 px-2 py-1 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </article>
              </a>
            ))}
          </div>
        </section>

        {/* Links Section */}
        <section
          id="links"
          ref={(el) => {
            sectionRefs.current.links = el;
          }}
          className="scroll-mt-16 min-h-[60vh] flex flex-col"
        >
          <h2 className="text-3xl mb-8">
            <AnimatedTitle
              key={`links-${animationKeys.links}`}
              text={SECTION_TITLES.links}
            />
          </h2>
          <div className="space-y-4">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xl py-3 -mx-2 px-2 rounded transition-colors hover:bg-accent/10 hover:text-accent group"
              >
                {link.label}
                <span className="text-muted text-base ml-3 group-hover:text-accent/60 transition-colors">
                  &rarr;
                </span>
                <span className="text-accent text-base ml-3">
                  {link.display}
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
