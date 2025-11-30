import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import VideoDetail from './pages/VideoDetail';
import Settings from './pages/Settings';
import Favorites from './pages/Favorites';
import DataCheck from './pages/DataCheck';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="video/:id" element={<VideoDetail />} />
                    <Route path="favorites" element={<Favorites />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="data-check" element={<DataCheck />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
