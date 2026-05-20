import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react'; // <-- Garanta que essa linha existe

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(), // <-- Esse cara PRECISA estar aqui dentro para ativar o @react-refresh!
    ],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});