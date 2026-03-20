import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCommunities, joinCommunity } from '../api.js';

const CommunitiesPage = () => {
  const [communities, setCommunities] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Discovered');
  const [selectedFilter, setSelectedFilter] = useState('Public');
  const [loading, setLoading] = useState(false);

  const categories = ['Discovered', 'Joined', 'Trending', 'Archives'];
  const filters = ['Public', 'Private', 'Secret'];

  const sampleCommunities = [
    {
      id: 1,
      name: 'The Tea Room',
      description: 'Daily brewing rituals and quiet afternoon gossip sessions.',
      type: 'Public',
      members: 2400,
      active: 120,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpuMxjUvJ-Cv9T73ZK_JcTxnYr1GZ6YQj36OOqGKv7e_KtozY-lecFgbi8wxF8mSf9jhyXcLHqooM5AsDJH00CLNGzm5iYMbmm_Ul4-zmysb9nBoInhhxlEiAoE6NyrXz-V7DnyonhTQ4hcPO3VnjONPYmk7WRhZUxoFVSoftsz-BB3JMzlqZUXcI58N0w-kUhfpVquIPogrtH9MVzh6gamXlLjuI9pobro5YI_YdpUHNWHdNorXPhAamK5E4t9oByV5_TUZs3V9o',
      locked: false
    },
    {
      id: 2,
      name: 'Gossip Lounge',
      description: 'A restricted space for minimalist living enthusiasts.',
      type: 'Private',
      members: 850,
      active: 45,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD58OoKeIwgvF2IwqCY0R5drG7bn6VRUIVFmg2p5wPRvbpihlvrH6yY00gG65bJsZX82U_XJqaHQuiLNGxJLTJJnnrYflCjLs3TNG9ABoGW-GkxQtSn_I1WxPChDjPmTLh9lAr3qrsQxBFPOIV3MzoiBuLL8KprWYxpqXQlubVPSmTtxP8kvJriRgFN9Spj48t4ZIn5xkaHdBdkKPCVi0ESnXWeHeSqHYbVDEzb7ak1yM5z8vDZeZR9IRzThstVeGmd4IygrmEiT68',
      locked: true
    },
    {
      id: 3,
      name: 'Night Talk',
      description: 'Anonymous tales from the night. No names, just vibes.',
      type: 'Secret',
      members: 1200,
      active: 200,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuxpwNFFltbZHhMCFcMsAcEphcswmJO2wkU-gJH_F11i8nu6ap73Dgb1w-TSnpyvxrFKrMEJPc0DdrBENLPrEIjnrbspqtUZkNRPUYxs_MFHZ_rUW6QJG4hQEbdt8aiG9ieUsFj1aIt7VQZHE2roejuv6d89N28lTuwvj5TGtIKK-n5WpbprKtL0YRlaiOLMAxFf_GB3cqY896qyAsbnc3gwhF85_RsyiOilfjEjj_785kFw02R6t_h_m1YNLbTpRyQmG9iwFdh_4',
      locked: true
    }
  ];

  useEffect(() => {
    fetchCommunities();
  }, []);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const { data, error } = await getCommunities();
      
      if (error) {
        console.error('Error fetching communities:', error);
        // Fallback to sample communities if API fails
        setCommunities(sampleCommunities);
      } else {
        // Transform Supabase data to match our component structure
        const transformedCommunities = data.map(community => ({
          id: community.id,
          name: community.name,
          description: community.description,
          type: community.type || 'Public',
          members: community.members?.[0]?.count || 0,
          active: Math.floor(Math.random() * 200) + 10, // Random active users for now
          image: community.image_url || 'https://via.placeholder.com/400x200',
          locked: community.type !== 'Public'
        }));
        setCommunities(transformedCommunities);
      }
    } catch (error) {
      console.error('Error fetching communities:', error);
      setCommunities(sampleCommunities);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      const { error } = await joinCommunity(communityId);
      
      if (error) {
        console.error('Error joining community:', error);
      } else {
        // Update the community in state to show as joined
        setCommunities(communities.map(community => 
          community.id === communityId 
            ? { ...community, joined: true }
            : community
        ));
      }
    } catch (error) {
      console.error('Error joining community:', error);
    }
  };

  const filteredCommunities = communities.filter(community => {
    const categoryMatch = selectedCategory === 'Discovered' || 
      (selectedCategory === 'Joined' && community.joined) ||
      (selectedCategory === 'Trending' && community.trending);
    
    const filterMatch = selectedFilter === 'Public' ? community.type === 'Public' :
      selectedFilter === 'Private' ? community.type === 'Private' :
      selectedFilter === 'Secret' ? community.type === 'Secret' : true;
    
    return categoryMatch && filterMatch;
  });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm p-2 text-center">
          <span className="text-primary">Loading communities...</span>
        </div>
      )}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 md:px-20 py-8">
        {/* Breadcrumbs & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Communities</h1>
            <p className="text-sage-text dark:text-slate-400 font-medium">Discover quiet spaces for loud thoughts.</p>
          </div>
          <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined">add_circle</span>
            <span>Create New Group</span>
          </button>
        </div>

        {/* Categories Tabs */}
        <div className="flex border-b border-sage-soft dark:border-slate-800 mb-8 overflow-x-auto no-scrollbar">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`border-b-2 px-6 pb-4 text-sm font-medium whitespace-nowrap ${
                selectedCategory === category
                  ? 'border-primary text-slate-900 dark:text-white'
                  : 'border-transparent text-sage-500 hover:text-primary transition-colors'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Filter Chips */}
        <div className="flex gap-3 mb-8 overflow-x-auto no-scrollbar">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                selectedFilter === filter
                  ? 'bg-primary text-white'
                  : 'bg-sage-soft dark:bg-slate-800 text-sage-text dark:text-slate-300 hover:bg-primary/10 transition-colors'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Community Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCommunities.map(community => (
            <div key={community.id} className="group flex flex-col bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-sage-soft dark:border-slate-800 hover:shadow-xl hover:shadow-primary/5 transition-all">
              <div className="relative h-48 w-full bg-center bg-cover transition-transform group-hover:scale-105" style={{backgroundImage: `url(${community.image})`}}>
                <div className={`absolute top-3 right-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                  community.type === 'Public' ? 'bg-white/90 backdrop-blur text-sage-text' :
                  community.type === 'Private' ? 'bg-primary px-2 py-1 rounded-md text-[10px] font-bold uppercase text-white' :
                  'bg-slate-900 px-2 py-1 rounded-md text-[10px] font-bold uppercase text-white'
                }`}>
                  {community.type}
                </div>
              </div>
              <div className="p-5 flex flex-col grow">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{community.name}</h3>
                <p className="text-sm text-sage-500 dark:text-slate-400 mb-4 line-clamp-2">{community.description}</p>
                <div className="mt-auto pt-4 border-t border-sage-soft dark:border-slate-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary">{community.members} members</span>
                    <span className="text-[10px] text-sage-text dark:text-slate-500 uppercase font-medium">{community.active} currently active</span>
                  </div>
                  <button 
                    onClick={() => handleJoinCommunity(community.id)}
                    className="p-2 rounded-full bg-sage-soft dark:bg-slate-800 text-primary hover:bg-primary hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined">
                      {community.joined ? 'check' : community.locked ? 'lock' : 'chevron_right'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Suggestion Footer */}
        <section className="mt-16 bg-sage-soft/30 dark:bg-slate-900/50 rounded-xl p-8 border border-sage-soft dark:border-slate-800">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Can't find your tribe?</h2>
              <p className="text-sage-500 dark:text-slate-400">Start a unique community and invite people who share your interests. Keep it real, keep it fun.</p>
            </div>
            <div className="flex gap-4">
              <button className="px-8 py-3 rounded-xl border border-primary text-primary font-semibold hover:bg-primary/10 transition-colors">View All Guides</button>
              <button className="px-8 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">Start Now</button>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation Mobile */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-background-dark/90 backdrop-blur-lg border-t border-primary/10 px-6 py-3 flex justify-between items-center z-50">
        <Link to="/communities" className="flex flex-col items-center text-primary gap-1">
          <span className="material-symbols-outlined">groups</span>
          <span className="text-[10px] font-bold uppercase">Groups</span>
        </Link>
        <Link to="/dashboard" className="flex flex-col items-center text-sage-500 gap-1">
          <span className="material-symbols-outlined">chat_bubble</span>
          <span className="text-[10px] font-bold uppercase">Chats</span>
        </Link>
        <div className="-mt-8 bg-primary p-3 rounded-full shadow-lg shadow-primary/30 border-4 border-background-light dark:border-background-dark">
          <span className="material-symbols-outlined text-white">add</span>
        </div>
        <Link to="/feed" className="flex flex-col items-center text-sage-500 gap-1">
          <span className="material-symbols-outlined">explore</span>
          <span className="text-[10px] font-bold uppercase">Feed</span>
        </Link>
        <Link to="/profile" className="flex flex-col items-center text-sage-500 gap-1">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </Link>
      </footer>
    </div>
  );
};

export default CommunitiesPage;
