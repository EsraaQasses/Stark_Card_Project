import { useEffect } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by the installed Syncfusion grid suite
import {
  enableRtl,
  L10n,
} from '@syncfusion/ej2-base';

let localeLoaded = false;

const loadLocale = () => {
  if (localeLoaded) {
    return;
  }

  L10n.load({
    ar: {
      grid: {
        EmptyRecord:
          'لا توجد سجلات لعرضها',

        True: 'نعم',
        False: 'لا',

        InvalidFilterMessage:
          'بيانات الفلترة غير صالحة',

        GroupDropArea:
          'اسحب رأس العمود إلى هنا لتجميع هذا العمود',

        UnGroup:
          'انقر لإلغاء التجميع',

        FilterbarTitle:
          'شريط الفلترة',

        Search: 'بحث',

        Print: 'طباعة',

        ExcelExport:
          'تصدير إكسل',

        PdfExport:
          'تصدير PDF',

        WordExport:
          'تصدير Word',

        Add: 'إضافة',

        Edit: 'تعديل',

        Delete: 'حذف',

        Update: 'تحديث',

        Cancel: 'إلغاء',

        EditFormTitle:
          'تفاصيل السجل',

        Save: 'حفظ',

        FilterMenuDialog:
          'فلترة',

        FilterMenuTitle:
          'فلترة',

        OKButton: 'موافق',

        CancelButton: 'إلغاء',

        ClearButton: 'مسح',
      },

      pager: {
        currentPageInfo:
          '{0} من {1} صفحة ({2} عنصر)',

        totalItemsInfo:
          '({0} عناصر)',

        firstPageTooltip:
          'الصفحة الأولى',

        lastPageTooltip:
          'الصفحة الأخيرة',

        nextPageTooltip:
          'الصفحة التالية',

        previousPageTooltip:
          'الصفحة السابقة',

        nextPagerTooltip:
          'العناصر التالية',

        previousPagerTooltip:
          'العناصر السابقة',

        pagerDropDown:
          'عناصر لكل صفحة',

        pagerAllDropDown:
          'الكل',

        All: 'الكل',
      },
    },

    'en-US': {
      grid: {
        EmptyRecord:
          'No records to display',

        GroupDropArea:
          'Drag a column header here to group its column',

        Search: 'Search',
        Print: 'Print',

        ExcelExport:
          'Excel Export',

        PdfExport:
          'PDF Export',

        Add: 'Add',
        Edit: 'Edit',
        Delete: 'Delete',
        Update: 'Update',
        Cancel: 'Cancel',
        Save: 'Save',
      },

      pager: {
        currentPageInfo:
          '{0} of {1} pages ({2} items)',

        totalItemsInfo:
          '({0} items)',

        firstPageTooltip:
          'First page',

        lastPageTooltip:
          'Last page',

        nextPageTooltip:
          'Next page',

        previousPageTooltip:
          'Previous page',
      },
    },
  });

  localeLoaded = true;
};

const useSyncfusionGridLocale = (
  language,
) => {
  useEffect(() => {
    loadLocale();

    const isRtl = (
      language === 'ar'
      || language?.startsWith('ar')
    );

    enableRtl(isRtl);
  }, [language]);
};

export default useSyncfusionGridLocale;