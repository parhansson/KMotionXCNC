
import { Component, Directive, EventEmitter, ElementRef } from '@angular/core'
import * as AceAjax from 'brace'


@Directive({
    selector: '[aceEditor]',
    inputs: [
        'text',
        'mode',
        'theme'
    ],
    outputs: [
        'textChanged'
    ]
})
export class AceDirective {
    private editor: AceAjax.Editor
    public textChanged: EventEmitter<AceAjax.EditorChangeEvent>

    selectRow(row: number){
        this.editor.selection.moveCursorToPosition({row, column: 0})
        this.editor.centerSelection()
    }

    set text(s: string) {
        if (s) {

            this.editor.setValue(s)
        } else {
            this.editor.setValue('')
        }
        this.editor.clearSelection()
        //this.editor.focus();
    }
    get text() {
        return this.editor.getValue()
    }
    set theme(theme: string) {
        if (theme) {
            this.editor.setTheme('ace/theme/' + theme)
        }
    }
    set mode(mode: string) {
        if (mode) {
            this.editor.getSession().setMode('ace/mode/' + mode)
        }
    }

    constructor(elementRef: ElementRef) {
        this.textChanged = new EventEmitter<AceAjax.EditorChangeEvent>()

        const el = elementRef.nativeElement as HTMLElement
        el.style.height = '100%'
        el.style.width = '100%'

        this.editor = AceAjax.edit(el)
        this.editor.$blockScrolling = Infinity // Removes annoying scroll warning
        this.editor.resize(true)
        this.editor.setTheme('ace/theme/chrome')


        this.editor.addEventListener('change', (e) => {
            this.textChanged.next(e)
        })
    }
}