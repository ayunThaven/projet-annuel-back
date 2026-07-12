export type SimilarIdeaItem = {
  id: string;
  type: 'CONTENT' | 'CURATION' | 'IDEA';
  title: string;
  score: number;
};

export type GeneratedIdeaPayload = {
  title: string;
  angle: string;
  contentType: string;
  keywords: string[];
  searchIntent: string;
  rationale: string;
};
