import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import VideoDetail from './pages/VideoDetail';
import VocabDetail from './pages/VocabDetail';
import Settings from './pages/Settings';
import Favorites from './pages/Favorites';
import Notebooks from './pages/Notebooks';
import DataCheck from './pages/DataCheck';
import Auth from './pages/Auth';

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
                    <Route path="settings" element={<Settings />} />
                    <Route path="data-check" element={<DataCheck />} />
                    <Route path="login" element={<Auth />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
