import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Plus, User } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Story } from '../types';
import CreateStoryModal from './CreateStoryModal';
import StoryViewer from './StoryViewer';
import { AnimatePresence } from 'motion/react';

export default function StoriesBar() {
  const { currentUser, userProfile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const storiesRef = collection(db, 'stories');
    const q = query(storiesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStories = snapshot.docs.map(doc => doc.data() as Story);
      const now = Date.now();
      // Filter stories that haven't expired yet
      const activeStories = fetchedStories.filter(story => story.expiresAt > now);
      setStories(activeStories);

      // Background prefetching for high-performance instant loading
      try {
        const storiesToPrefetch = activeStories.slice(0, 10);
        storiesToPrefetch.forEach(story => {
          const thumbUrl = story.thumbnailUrl || story.imageUrl;
          if (thumbUrl) {
            const thumbImg = new Image();
            thumbImg.src = thumbUrl;
          }
          if (story.imageUrl) {
            const origImg = new Image();
            origImg.src = story.imageUrl;
          }
        });
      } catch (err) {
        console.error("Error prefetching story images:", err);
      }
    }, (err) => {
      console.error("Stories fetch error:", err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Group active stories by userId
  const groupedUsers: Record<string, { username: string; photoURL: string | null; stories: Story[] }> = {};
  stories.forEach(story => {
    if (!groupedUsers[story.userId]) {
      groupedUsers[story.userId] = {
        username: story.username,
        photoURL: story.userPhotoURL,
        stories: []
      };
    }
    groupedUsers[story.userId].stories.push(story);
  });

  const uniqueUsersWithStories = Object.keys(groupedUsers).map(uid => ({
    userId: uid,
    ...groupedUsers[uid]
  }));

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-3 px-4 transition-colors">
      <div className="flex gap-4 overflow-x-auto no-scrollbar items-center select-none py-1">
        
        {/* Current User: Add Story Button */}
        <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
          <div 
            onClick={() => setIsCreateOpen(true)}
            className="relative w-14 h-14 rounded-full p-[2px] bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300"
          >
            <div className="w-full h-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-750">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="Profilim" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <User size={22} />
                </div>
              )}
            </div>
            
            {/* Plus Badge */}
            <span className="absolute bottom-0 right-0 block bg-blue-600 dark:bg-blue-500 text-white p-1 rounded-full border-2 border-white dark:border-gray-900 shadow-sm transition-transform group-hover:scale-110">
              <Plus size={10} className="stroke-[3]" />
            </span>
          </div>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1.5 truncate max-w-[64px]">
            Hikâyen
          </span>
        </div>

        {/* Other Users' Stories */}
        {uniqueUsersWithStories.map((userStoryGroup, index) => {
          const hasUnread = true; // For now we keep it blue colored border
          return (
            <div 
              key={userStoryGroup.userId}
              onClick={() => setActiveStoryIndex(index)}
              className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
            >
              <div className={`relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr ${
                hasUnread ? 'from-amber-500 via-pink-500 to-purple-600' : 'from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800'
              } transition-all duration-300 transform hover:scale-105 active:scale-95`}>
                <div className="w-full h-full rounded-full border-2 border-white dark:border-gray-900 overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {userStoryGroup.photoURL ? (
                    <img src={userStoryGroup.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-sm">
                      {userStoryGroup.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 mt-1.5 truncate max-w-[64px] group-hover:text-blue-500 transition-colors">
                {userStoryGroup.username}
              </span>
            </div>
          );
        })}

        {/* Empty status message if no other stories */}
        {uniqueUsersWithStories.length === 0 && (
          <div className="flex-1 flex items-center justify-start h-14 pl-2 text-xs text-gray-400 dark:text-gray-500 italic">
            Henüz hikâye paylaşılmamış.
          </div>
        )}
      </div>

      {/* Add Story Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <CreateStoryModal onClose={() => setIsCreateOpen(false)} />
        )}
      </AnimatePresence>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {activeStoryIndex !== null && (
          <StoryViewer 
            stories={stories}
            initialUserIndex={activeStoryIndex}
            onClose={() => setActiveStoryIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
