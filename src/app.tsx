import React, { useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { ScholarshipCard } from '@/components/ScholarshipCard';
import { Footer } from '@/components/Footer';
import { LegalSections } from '@/components/LegalSections';
import { findScholarships, findCourses } from '@/services/gemini';
import { CourseCard } from '@/components/CourseCard';
import { SearchParams, SearchResult, CourseSearchResult } from '@/types';

type AppPage = 'dashboard' | 'consultancy' | 'profile';


const iconClassName = 'w-5 h-5';

function GraduationCapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${iconClassName} ${className || ''}`.trim()}>
      <path d="M3 9l9-4 9 4-9 4-9-4Z" />
      <path d="M7 11v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-3" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${iconClassName} ${className || ''}`.trim()}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${iconClassName} ${className || ''}`.trim()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${iconClassName} ${className || ''}`.trim()}>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${iconClassName} ${className || ''}`.trim()}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

interface UserProfile {
  fullName: string;
  originCountry: string;
  targetMajor: string;
  targetRegion: string;
  studyLevel: string;
  gpa: string;
  sat: string;
  interests: string;
  achievements: string;
}

interface ScholarshipFilters {
  originCountry: string;
  studyLevel: string;
  targetRegion: string;
  fieldOfStudy: string;
}

interface ConsultancyMessage {
  from: 'you' | 'advisor';
  text: string;
}

const sanitizeConsultancyReply = (reply: string): string => {
  return reply
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/(^|\n)\s*(reasoning|thought process|analysis)\s*:\s*[\s\S]*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const PROFILE_STORAGE_KEY = 'scholira-user-profile';
const SCHOLARSHIP_FILTERS_STORAGE_KEY = 'scholira-scholarship-filters';

const emptyProfile: UserProfile = {
  fullName: '',
  originCountry: '',
  targetMajor: '',
  targetRegion: '',
  studyLevel: '',
  gpa: '',
  sat: '',
  interests: '',
  achievements: '',
};

const scholarshipCountries = ['Any', 'India', 'Nigeria', 'Kenya', 'Pakistan', 'Bangladesh', 'United States', 'Canada'];
const scholarshipStudyLevels = ['Any', 'Bachelor', 'Master', 'PhD', 'Diploma'];
const scholarshipRegions = ['Europe', 'UK', 'USA & Canada', 'Asia', 'Australia & NZ'];
const scholarshipFields = [
  'Any',
  'Computer Science',
  'Data Science',
  'Business',
  'Engineering',
  'Medicine',
  'Public Policy',
  'Law',
  'Arts & Humanities',
];

const courseSubjects = ['Any', 'Computer Science', 'Data Science', 'Business', 'Design', 'Language', 'Health'];
const courseLevels = ['Any', 'Beginner', 'Intermediate', 'Advanced'];

const hasCompletedProfile = (profile: UserProfile) =>
  Boolean(profile.fullName && profile.originCountry && profile.targetMajor && profile.studyLevel);

const getDefaultScholarshipFilters = (profile: UserProfile): ScholarshipFilters => ({
  originCountry: profile.originCountry || 'Any',
  studyLevel: profile.studyLevel || 'Any',
  targetRegion: profile.targetRegion || 'Any',
  fieldOfStudy: profile.targetMajor || 'Any',
});

function DashboardPage({
  profile,
  scholarshipFilters,
  setScholarshipFilters,
  onOpenConsultancy,
  onOpenProfile,
}: {
  profile: UserProfile;
  scholarshipFilters: ScholarshipFilters;
  setScholarshipFilters: React.Dispatch<React.SetStateAction<ScholarshipFilters>>;
  onOpenConsultancy: () => void;
  onOpenProfile: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'scholarships' | 'courses'>('scholarships');
  const [scholarshipResult, setScholarshipResult] = useState<SearchResult | null>(null);
  const [courseResult, setCourseResult] = useState<CourseSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [courseQuery, setCourseQuery] = useState(profile.targetMajor);
  const [courseFilters, setCourseFilters] = useState({
    subject: 'Any',
    level: 'Any',
    platform: 'Any',
  });
  const [autoRecommendationsLoaded, setAutoRecommendationsLoaded] = useState(false);

  const upcomingDeadlines = (scholarshipResult?.scholarships || [])
    .slice()
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const stats = [
    {
      label: 'Scholarships Found',
      value: scholarshipResult?.scholarships.length || 0,
      icon: GraduationCapIcon,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Courses Recommended',
      value: courseResult?.courses.length || 0,
      icon: FileTextIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Profile Completion',
      value: '100%',
      icon: CheckCircleIcon,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const recommendationParams: SearchParams = useMemo(
    () => ({
      originCountry: profile.originCountry || 'India',
      studyLevel: profile.studyLevel || 'Bachelor',
      fieldOfStudy: profile.targetMajor || 'Computer Science',
      targetRegion: profile.targetRegion || 'Global',
      gpa: profile.gpa,
      sat: profile.sat,
    }),
    [profile]
  );

  const handleScholarshipSearch = async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    setScholarshipResult(null);

    try {
      const data = await findScholarships(params);
      setScholarshipResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const refreshScholarshipsFromProfile = async () => {
    setScholarshipFilters(getDefaultScholarshipFilters(profile));
    await handleScholarshipSearch(recommendationParams);
  };

  const handleScholarshipFilterSearch = async () => {
    const params: SearchParams = {
      originCountry: scholarshipFilters.originCountry === 'Any' ? recommendationParams.originCountry : scholarshipFilters.originCountry,
      studyLevel: scholarshipFilters.studyLevel === 'Any' ? recommendationParams.studyLevel : scholarshipFilters.studyLevel,
      fieldOfStudy: scholarshipFilters.fieldOfStudy === 'Any' ? recommendationParams.fieldOfStudy : scholarshipFilters.fieldOfStudy,
      targetRegion: scholarshipFilters.targetRegion === 'Any' ? recommendationParams.targetRegion : scholarshipFilters.targetRegion,
      gpa: profile.gpa,
      sat: profile.sat,
    };

    await handleScholarshipSearch(params);
  };

  const handleCourseSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseQuery.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setCourseResult(null);
    try {
      const data = await findCourses({
        query: courseQuery.trim(),
        subject: courseFilters.subject === 'Any' ? undefined : courseFilters.subject,
        level: courseFilters.level === 'Any' ? undefined : courseFilters.level,
        platform: courseFilters.platform === 'Any' ? undefined : courseFilters.platform,
      });
      setCourseResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const runAutoRecommendations = async () => {
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const [scholarships, courses] = await Promise.all([
          findScholarships(recommendationParams),
          findCourses({ query: `${profile.targetMajor || ''} ${profile.interests || ''}`.trim() || 'High demand skills' }),
        ]);
        setScholarshipResult(scholarships);
        setCourseResult(courses);
      } catch (err: any) {
        setError(err.message || 'Could not load recommendations right now.');
      } finally {
        setLoading(false);
        setAutoRecommendationsLoaded(true);
      }
    };

    if (!autoRecommendationsLoaded) {
      runAutoRecommendations();
    }
  }, [autoRecommendationsLoaded, profile.interests, profile.targetMajor, recommendationParams]);

  return (
    <>
      <Hero />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-16">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-6 max-w-5xl mx-auto">
          <h2 className="text-slate-900 font-semibold">Welcome, {profile.fullName || 'Scholar'} 👋</h2>
          <p className="text-sm text-slate-700 mt-1">
            Your professional dashboard is personalized from your saved profile. Start with AI-picked scholarships, then continue with consultancy and courses.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={onOpenConsultancy} className="rounded-xl bg-emerald-700 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-800">
              Open AI Consultancy
            </button>
            <button onClick={() => setActiveTab('courses')} className="rounded-xl border border-emerald-200 text-emerald-800 px-4 py-2 text-sm font-semibold hover:bg-emerald-50">
              Open Courses
            </button>
          </div>
        </div>

        <section className="mt-8 space-y-8 max-w-6xl mx-auto">
          <div className="flex justify-between items-end flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Welcome back, {profile.fullName.split(' ')[0]}</h1>
              <p className="text-slate-500 mt-1">Here's what's happening with your applications today.</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Current GPA</p>
              <p className="text-2xl font-bold text-slate-900">{profile.gpa || 'Not set'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`${stat.color} w-6 h-6`} />
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ClockIcon className="text-slate-400" />
                Upcoming Deadlines
              </h2>
              <div className="space-y-4">
                {upcomingDeadlines.length === 0 ? (
                  <p className="text-slate-400 text-sm">No upcoming deadlines yet. Refresh scholarships from your profile.</p>
                ) : (
                  upcomingDeadlines.map((item) => {
                    const daysLeft = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={`${item.name}-${item.deadline}`} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Scholarship</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-emerald-600">{item.deadline}</p>
                          <p className="text-xs text-slate-400">{daysLeft} days left</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <TrendingUpIcon className="text-emerald-400" />
                  AI Insight
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  We now use your saved profile directly for scholarship matching, so you only enter your details once.
                  Update your profile only when your goals or scores change.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={refreshScholarshipsFromProfile}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
                  >
                    Refresh Scholarships
                  </button>
                  <button
                    onClick={onOpenProfile}
                    className="inline-flex items-center gap-2 border border-emerald-400/40 text-emerald-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/10 transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>

              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
            </div>
          </div>
        </section>

        <div className="relative z-30 flex justify-center mt-8 mb-8">
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 inline-flex shadow-sm" role="tablist" aria-label="Recommendation type">
            <button
              onClick={() => setActiveTab('scholarships')}
              role="tab"
              aria-selected={activeTab === 'scholarships'}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'scholarships' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              Scholarships
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              role="tab"
              aria-selected={activeTab === 'courses'}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'courses' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              Professional Courses
            </button>
          </div>
        </div>

        {activeTab === 'scholarships' ? (
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 p-8 max-w-4xl mx-auto relative z-10">
            <h3 className="font-bold text-slate-900 mb-1">Scholarships from your saved profile</h3>
            <p className="text-sm text-slate-600 mt-1">
              Scholarship filters are now managed from your Profile page and applied here.
            </p>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-slate-700">
              Current filters: {scholarshipFilters.originCountry} · {scholarshipFilters.studyLevel} · {scholarshipFilters.targetRegion} · {scholarshipFilters.fieldOfStudy}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleScholarshipFilterSearch}
                disabled={loading}
                className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Apply Profile Filters'}
              </button>
              <button
                type="button"
                onClick={onOpenProfile}
                className="rounded-xl border border-emerald-200 text-emerald-800 px-5 py-3 text-sm font-semibold hover:bg-emerald-50"
              >
                Update Profile Details
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 p-8 max-w-4xl mx-auto relative z-10">
            <h3 className="font-bold text-slate-900 mb-1">Find Professional Courses</h3>
            <form onSubmit={handleCourseSearch} className="flex flex-col gap-4 mt-5">
              <input
                type="text"
                placeholder="What do you want to learn?"
                className="w-full rounded-xl border-emerald-100 py-3 px-4 focus:ring-emerald-500"
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  className="rounded-xl border border-emerald-100 py-3 px-4 focus:ring-emerald-500"
                  value={courseFilters.subject}
                  onChange={(e) => setCourseFilters((prev) => ({ ...prev, subject: e.target.value }))}
                >
                  {courseSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      Subject: {subject}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-emerald-100 py-3 px-4 focus:ring-emerald-500"
                  value={courseFilters.level}
                  onChange={(e) => setCourseFilters((prev) => ({ ...prev, level: e.target.value }))}
                >
                  {courseLevels.map((level) => (
                    <option key={level} value={level}>
                      Level: {level}
                    </option>
                  ))}
                </select>
                <div className="inline-flex rounded-xl border border-emerald-100 p-1 bg-emerald-50/50">
                  {['Any', 'Coursera', 'edX'].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setCourseFilters((prev) => ({ ...prev, platform }))}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        courseFilters.platform === platform ? 'bg-emerald-700 text-white' : 'text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading} className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white px-8 py-3 rounded-xl font-bold">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        )}

        {error && (
          <div className="mt-8 max-w-4xl mx-auto rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {searched && !loading && (
          <section className="mt-12">
            <h3 className="font-bold text-lg text-slate-900 mb-4">
              {activeTab === 'scholarships' ? 'Recommended Scholarships' : 'Recommended Courses'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
              {activeTab === 'scholarships' && scholarshipResult?.scholarships.map((s, i) => <ScholarshipCard key={i} scholarship={s} />)}
              {activeTab === 'courses' && courseResult?.courses.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
            {activeTab === 'scholarships' && (scholarshipResult?.scholarships?.length ?? 0) === 0 && (
              <p className="text-center text-slate-500 mt-6">No scholarships found for this search. Try changing your criteria.</p>
            )}
            {activeTab === 'courses' && (courseResult?.courses?.length ?? 0) === 0 && (
              <p className="text-center text-slate-500 mt-6">No courses found for this query. Try broader keywords.</p>
            )}
          </section>
        )}
        <LegalSections />
      </main>
    </>
  );
}

function ConsultancyPage({ profile }: { profile: UserProfile }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ConsultancyMessage[]>([
    {
      from: 'advisor',
      text: `Welcome ${profile.fullName || ''}! I am your Scholira AI consultancy assistant. Share your target countries and deadlines to get a strategy.`,
    },
  ]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const newHistory = [...history, { from: 'you' as const, text: trimmed }];
    setHistory(newHistory);
    setMessage('');
    setLoading(true);

    try {
      const apiMessages = newHistory.map((item) => ({
        role: item.from === 'you' ? 'user' : 'assistant',
        content: item.text,
      }));

      const res = await fetch('https://scholira-consultancy.vishwajeetadkine705.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, userProfile: profile }),
      });

      if (!res.ok) {
        throw new Error(`Consultancy API error: ${res.status}`);
      }

      const data = (await res.json()) as { reply?: string };
      const cleanReply = sanitizeConsultancyReply(data.reply || '');
      setHistory((prev) => [
        ...prev,
        { from: 'advisor', text: cleanReply || 'I could not parse the response. Please try rephrasing your question.' },
      ]);
    } catch {
      setHistory((prev) => [...prev, { from: 'advisor', text: 'Sorry, I could not connect. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-emerald-100 bg-emerald-50/40">
          <h1 className="text-xl font-bold text-slate-900">AI Consultancy</h1>
          <p className="text-sm text-slate-600 mt-1">Ask profile-aware questions for admissions strategy, documents, and timelines.</p>
        </div>
        <div className="p-6 space-y-4 max-h-[420px] overflow-y-auto bg-slate-50/40">
          {history.map((item, idx) => (
            <div key={idx} className={`rounded-xl px-4 py-3 text-sm max-w-3xl ${item.from === 'you' ? 'ml-auto bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
              {item.text}
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-4 border-t border-emerald-100 flex gap-3 bg-white">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask about admissions strategy..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button type="submit" disabled={loading} className="rounded-xl bg-emerald-700 text-white px-5 py-2.5 font-semibold hover:bg-emerald-800 disabled:opacity-50">
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </main>
  );
}

function ProfilePage({
  profile,
  scholarshipFilters,
  onSaveScholarshipFilters,
  onSave,
}: {
  profile: UserProfile;
  scholarshipFilters: ScholarshipFilters;
  onSaveScholarshipFilters: (filters: ScholarshipFilters) => void;
  onSave: (profile: UserProfile) => void;
}) {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [filterData, setFilterData] = useState<ScholarshipFilters>(scholarshipFilters);
  const [isEditing, setIsEditing] = useState(!hasCompletedProfile(profile));

  useEffect(() => {
    setFormData(profile);
    setIsEditing(!hasCompletedProfile(profile));
  }, [profile]);

  useEffect(() => {
    setFilterData(scholarshipFilters);
  }, [scholarshipFilters]);

  const onChangeField = (field: keyof UserProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveScholarshipFilters(filterData);
    onSave(formData);
    setIsEditing(false);
  };

  return (
    <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-10">
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-xl p-8">
        <h1 className="text-xl font-bold text-slate-900">Professional Profile</h1>
        <p className="text-sm text-slate-600 mt-1 mb-6">Complete this first. It is saved locally and automatically opens your personalized dashboard with scholarship recommendations.</p>

        {hasCompletedProfile(profile) && !isEditing && (
          <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Saved profile details</h2>
            <p className="text-xs text-slate-600 mt-1">Your details are saved. You only need to fill this once unless you want to update something.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
              <p><span className="font-medium">Full name:</span> {profile.fullName || 'Not set'}</p>
              <p><span className="font-medium">Origin country:</span> {profile.originCountry || 'Not set'}</p>
              <p><span className="font-medium">Target major:</span> {profile.targetMajor || 'Not set'}</p>
              <p><span className="font-medium">Target region:</span> {profile.targetRegion || 'Not set'}</p>
              <p><span className="font-medium">Study level:</span> {profile.studyLevel || 'Not set'}</p>
              <p><span className="font-medium">GPA:</span> {profile.gpa || 'Not set'}</p>
            </div>
            <button type="button" onClick={() => setIsEditing(true)} className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
              Edit profile details
            </button>
          </div>
        )}

        {(isEditing || !hasCompletedProfile(profile)) && <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submitProfile}>
          <input placeholder="Full name" className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.fullName} onChange={(e) => onChangeField('fullName', e.target.value)} required />
          <input placeholder="Origin country" className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.originCountry} onChange={(e) => onChangeField('originCountry', e.target.value)} required />
          <input placeholder="Target major" className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.targetMajor} onChange={(e) => onChangeField('targetMajor', e.target.value)} required />
          <select className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.targetRegion} onChange={(e) => onChangeField('targetRegion', e.target.value)}>
            <option value="">Target region</option>
            {scholarshipRegions.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
          <input placeholder="Study level (Bachelor/Master/PhD)" className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.studyLevel} onChange={(e) => onChangeField('studyLevel', e.target.value)} required />
          <input placeholder="GPA" className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.gpa} onChange={(e) => onChangeField('gpa', e.target.value)} />
          <input placeholder="SAT/ACT score" className="rounded-xl border border-slate-200 px-4 py-2.5" value={formData.sat} onChange={(e) => onChangeField('sat', e.target.value)} />
          <textarea placeholder="Achievements" className="md:col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 min-h-28" value={formData.achievements} onChange={(e) => onChangeField('achievements', e.target.value)} />
          <textarea placeholder="Interests (comma separated)" className="md:col-span-2 rounded-xl border border-slate-200 px-4 py-2.5 min-h-24" value={formData.interests} onChange={(e) => onChangeField('interests', e.target.value)} />
          <div className="md:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Scholarship Filters</h2>
            <p className="text-xs text-slate-600 mt-1">These filters are applied from your Dashboard scholarship tab.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className="rounded-xl border border-emerald-100 py-3 px-4 focus:ring-emerald-500" value={filterData.originCountry} onChange={(e) => setFilterData((prev) => ({ ...prev, originCountry: e.target.value }))}>
                {scholarshipCountries.map((country) => <option key={country} value={country}>Country: {country}</option>)}
              </select>
              <select className="rounded-xl border border-emerald-100 py-3 px-4 focus:ring-emerald-500" value={filterData.studyLevel} onChange={(e) => setFilterData((prev) => ({ ...prev, studyLevel: e.target.value }))}>
                {scholarshipStudyLevels.map((level) => <option key={level} value={level}>Study Level: {level}</option>)}
              </select>
              <select className="rounded-xl border border-emerald-100 py-3 px-4 focus:ring-emerald-500" value={filterData.targetRegion} onChange={(e) => setFilterData((prev) => ({ ...prev, targetRegion: e.target.value }))}>
                {scholarshipRegions.map((region) => <option key={region} value={region}>Target Region: {region}</option>)}
              </select>
              <select className="rounded-xl border border-emerald-100 py-3 px-4 focus:ring-emerald-500" value={filterData.fieldOfStudy} onChange={(e) => setFilterData((prev) => ({ ...prev, fieldOfStudy: e.target.value }))}>
                {scholarshipFields.map((field) => <option key={field} value={field}>Field of Study: {field}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="md:col-span-2 rounded-xl bg-emerald-700 text-white py-3 font-semibold hover:bg-emerald-800">Save Profile & Open Dashboard</button>
        </form>}
      </div>
    </main>
  );
}

function readProfile(): UserProfile | null {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return { ...emptyProfile, ...(JSON.parse(raw) as Partial<UserProfile>) };
  } catch {
    return null;
  }
}

function readScholarshipFilters(profile: UserProfile): ScholarshipFilters {
  const raw = window.localStorage.getItem(SCHOLARSHIP_FILTERS_STORAGE_KEY);
  if (!raw) return getDefaultScholarshipFilters(profile);
  try {
    return { ...getDefaultScholarshipFilters(profile), ...(JSON.parse(raw) as Partial<ScholarshipFilters>) };
  } catch {
    return getDefaultScholarshipFilters(profile);
  }
}

function getInitialPage(savedProfile: UserProfile | null): AppPage {
  const hash = window.location.hash.replace('#', '').toLowerCase();

  if (!savedProfile || !hasCompletedProfile(savedProfile)) {
    return 'profile';
  }

  if (hash === 'consultancy') return 'consultancy';
  if (hash === 'profile') return 'profile';
  return 'dashboard';
}

function App() {
  const [profile, setProfile] = useState<UserProfile>(() => readProfile() || emptyProfile);
  const [scholarshipFilters, setScholarshipFilters] = useState<ScholarshipFilters>(() => {
    const savedProfile = readProfile() || emptyProfile;
    return readScholarshipFilters(savedProfile);
  });
  const [page, setPage] = useState<AppPage>(() => getInitialPage(readProfile()));

  useEffect(() => {
    const onHashChange = () => {
      const latestProfile = readProfile();
      const resolvedProfile = latestProfile || emptyProfile;
      setProfile(resolvedProfile);
      setScholarshipFilters(readScholarshipFilters(resolvedProfile));
      setPage(getInitialPage(latestProfile));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: AppPage) => {
    if (!hasCompletedProfile(profile) && next !== 'profile') {
      window.location.hash = 'profile';
      setPage('profile');
      return;
    }

    if (next === 'dashboard') {
      window.location.hash = '';
    } else {
      window.location.hash = next;
    }
    setPage(next);
  };

  const saveProfile = (nextProfile: UserProfile) => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
    navigate('dashboard');
  };

  const saveScholarshipFilters = (nextFilters: ScholarshipFilters) => {
    window.localStorage.setItem(SCHOLARSHIP_FILTERS_STORAGE_KEY, JSON.stringify(nextFilters));
    setScholarshipFilters(nextFilters);
  };

  return (
    <div id="top" className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-teal-50 flex flex-col">
      <Navbar currentPage={page === 'dashboard' ? 'search' : page} onNavigate={(p) => navigate(p === 'search' ? 'dashboard' : p)} />
      {page === 'dashboard' && (
        <DashboardPage
          profile={profile}
          scholarshipFilters={scholarshipFilters}
          setScholarshipFilters={setScholarshipFilters}
          onOpenConsultancy={() => navigate('consultancy')}
          onOpenProfile={() => navigate('profile')}
        />
      )}
      {page === 'consultancy' && <ConsultancyPage profile={profile} />}
      {page === 'profile' && (
        <ProfilePage
          profile={profile}
          scholarshipFilters={scholarshipFilters}
          onSaveScholarshipFilters={saveScholarshipFilters}
          onSave={saveProfile}
        />
      )}
      <Footer />
    </div>
  );
}

export default App;
