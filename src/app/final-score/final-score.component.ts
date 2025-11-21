import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';

@Component({
    selector: 'app-final-score',
    imports: [CommonModule, NgClass],
    templateUrl: './final-score.component.html', // Assuming you'll display level/points in HTML
    styleUrl: './final-score.component.scss',
})
export class FinalScoreComponent {
    @Input() wpm = 0;
    @Input() accuracy = 0;
    @Input() level = 1;
    @Input() points = 0;
    @Output() close = new EventEmitter<void>();

    onClose(): void {
        this.close.emit();
    }
}