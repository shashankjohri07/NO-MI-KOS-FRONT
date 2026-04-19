import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface HeroStat {
  num: string;
  label: string;
}

export interface ProblemStat {
  num: string;
  title: string;
  sub: string;
}

export type TagVariant = 'live' | 'soon' | 'later';

export interface Product {
  tag: string;
  tagVariant: TagVariant;
  icon: string;
  title: string;
  description: string;
  features: string[];
}

export interface HowStep {
  num: string;
  title: string;
  body: string;
}

export interface AudienceItem {
  icon: string;
  title: string;
  role: string;
  body: string;
  features: string[];
}

export interface Testimonial {
  initials: string;
  quote: string;
  name: string;
  role: string;
}

export interface PricingPlan {
  tier: string;
  amount: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface ContentData {
  heroStats: HeroStat[];
  problemStats: ProblemStat[];
  products: Product[];
  howSteps: HowStep[];
  audience: AudienceItem[];
  testimonials: Testimonial[];
  pricing: PricingPlan[];
  navLinks: NavLink[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const contentApi = {
  async getAllContent(): Promise<ContentData> {
    const response = await apiClient.get<ApiResponse<ContentData>>('/content');
    return response.data.data;
  },
};

export default contentApi;
