import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
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
                    <Route index element={<Home />} />
                    <Route path="video/:id" element={<VideoDetail />} />
                    <Route path="vocab-detail/:word" element={<VocabDetail />} />
                    <Route path="favorites" element={<Favorites />} />
                    <Route path="notebooks" element={<Notebooks />} />
                    <Route path="notebooks/:notebookId/review" element={<NotebookReviewPage />} />
                    <Route path="review-stats" element={<ReviewStatsPage />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="settings/more" element={<MoreSettings />} />
                    <Route path="settings/devices" element={<DeviceManagement />} />
                    <Route path="settings/feedback" element={<FeedbackPage />} />
                    <Route path="settings/profile" element={<ProfileEdit />} />
                    <Route path="settings/about" element={<AboutPage />} />
                    <Route path="data-check" element={<DataCheck />} />
                    <Route path="login" element={<Auth />} />
                    <Route path="activate/:token" element={<Activate />} />
                    <Route path="admin/generate-link" element={<AdminGenerateLink />} />
                </Route>
            </Routes>
        </BrowserRouter>

    );
}

export default App;

