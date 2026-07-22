import courseData from "../data/course.json";
import type { Course, Section } from "./types";

export const course = courseData as Course;

export function getSection(id: string): Section | undefined {
  return course.sections.find((s) => s.id === id);
}
