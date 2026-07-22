export interface AudioRef {
  file: string;
  start: number;
  end: number;
}

export interface Item {
  id: string;
  text: string;
  ipa: string;
  ja: string;
  pos?: string;
  audio?: AudioRef;
  difficulty_flags: string[];
  alignment_confidence?: number;
}

export interface Section {
  id: string;
  title: string;
  content_type: string;
  learning_methods: string[];
  rationale: string;
  items: Item[];
}

export interface CourseMeta {
  title: string;
  level: string;
  lang: string;
  source_files: string[];
}

export interface Course {
  meta: CourseMeta;
  sections: Section[];
}
