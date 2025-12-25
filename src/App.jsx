import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import VideoDetail from './pages/VideoDetail';
import VocabDetail from './pages/VocabDetail';
import Settings from './pages/Settings';
import MoreSettings from './pages/MoreSettings';
import DeviceManagement from './pages/DeviceManagement';
import FeedbackPage from './pages/FeedbackPage';
import ProfileEdit from './pages/ProfileEdit';
import AboutPage from './pages/AboutPage';
import Favorites from './pages/Favorites';
import Notebooks from './pages/Notebooks';
import NotebookReviewPage from './pages/NotebookReviewPage';
import ReviewStatsPage from './pages/ReviewStatsPage';
import DataCheck from './pages/DataCheck';
import Auth from './pages/Auth';
import Activate from './pages/Activate';
import AdminGenerateLink from './pages/AdminGenerateLink';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    {/* 需要登录才能访问的页面 */}
                    <Route index element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="video/:id" element={<ProtectedRoute><VideoDetail /></ProtectedRoute>} />
                    <Route path="vocab-detail/:word" element={<ProtectedRoute><VocabDetail /></ProtectedRoute>} />
                    <Route path="favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
                    <Route path="notebooks" element={<ProtectedRoute><Notebooks /></ProtectedRoute>} />
                    <Route path="notebooks/:notebookId/review" element={<ProtectedRoute><NotebookReviewPage /></ProtectedRoute>} />
                    <Route path="review-stats" element={<ProtectedRoute><ReviewStatsPage /></ProtectedRoute>} />
                    <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="settings/more" element={<ProtectedRoute><MoreSettings /></ProtectedRoute>} />
                    <Route path="settings/devices" element={<ProtectedRoute><DeviceManagement /></ProtectedRoute>} />
                    <Route path="settings/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
                    <Route path="settings/profile" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
                    <Route path="settings/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
                    <Route path="data-check" element={<ProtectedRoute><DataCheck /></ProtectedRoute>} />

                    {/* 不需要登录的页面 */}
                    <Route path="login" element={<Auth />} />
                    <Route path="activate/:token" element={<Activate />} />
                    <Route path="admin/generate-link" element={<AdminGenerateLink />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
