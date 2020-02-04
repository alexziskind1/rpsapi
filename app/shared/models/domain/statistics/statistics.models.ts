import { PtItem } from '../';

export interface ItemsForMonth {
    closed: PtItem[];
    open: PtItem[];
}

export interface FilteredIssues {
    categories: Date[];
    items: ItemsForMonth[];
}
