import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./typing/typing.component').then(m => m.TypingComponent)
    }
];
