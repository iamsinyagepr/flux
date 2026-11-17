// Synced from Upskale Studio (upskaleapp/src/console/constants/studio/studio-icon/index.ts). Edit it there, then npm run sync.
import type { IconType } from "react-icons";
import {
  MdShoppingBag, MdMenu, MdClose, MdSearch, MdPerson, MdHome, MdReceipt, MdStar, MdAccessTime, MdAdd, MdRemove, MdChevronLeft,
  MdChevronRight, MdExpandMore, MdSettings, MdLocationOn, MdFavorite, MdEmail, MdCheck, MdShoppingCart, MdLocalShipping,
  MdCardGiftcard, MdLocalOffer, MdCreditCard, MdPayments, MdLocalCafe, MdPhone, MdChat, MdNotifications, MdInfo, MdWarning,
  MdHelp, MdThumbUp, MdLock, MdVisibility, MdEdit, MdDelete, MdShare, MdRefresh, MdLogout, MdPhotoCamera, MdImage, MdList,
  MdGridView, MdCalendarToday, MdMap, MdNavigation, MdArrowBack, MdArrowForward, MdExpandLess, MdLightMode, MdDarkMode,
} from "react-icons/md";
import {
  FiShoppingBag, FiMenu, FiX, FiSearch, FiUser, FiHome, FiFileText, FiStar, FiClock, FiPlus, FiMinus, FiChevronLeft,
  FiChevronRight, FiChevronDown, FiSettings, FiMapPin, FiHeart, FiMail, FiCheck, FiShoppingCart, FiTruck, FiGift, FiTag,
  FiCreditCard, FiDollarSign, FiCoffee, FiPhone, FiMessageCircle, FiBell, FiInfo, FiAlertTriangle, FiHelpCircle, FiThumbsUp,
  FiLock, FiEye, FiEdit2, FiTrash2, FiShare2, FiRefreshCw, FiLogOut, FiCamera, FiImage, FiList, FiGrid, FiCalendar, FiMap,
  FiNavigation, FiArrowLeft, FiArrowRight, FiChevronUp, FiSun, FiMoon,
} from "react-icons/fi";
import {
  BsBagFill, BsList, BsX, BsSearch, BsPersonFill, BsHouseFill, BsReceipt, BsStarFill, BsClock, BsPlus, BsDash, BsChevronLeft,
  BsChevronRight, BsChevronDown, BsGearFill, BsGeoAltFill, BsHeartFill, BsEnvelopeFill, BsCheck, BsCart, BsTruck, BsGift, BsTag,
  BsCreditCard, BsCash, BsCupHot, BsTelephoneFill, BsChatFill, BsBellFill, BsInfoCircle, BsExclamationTriangle, BsQuestionCircle,
  BsHandThumbsUp, BsLockFill, BsEye, BsPencil, BsTrash, BsShare, BsArrowClockwise, BsBoxArrowRight, BsCamera, BsImage, BsListUl,
  BsGrid, BsCalendar, BsMap, BsCursor, BsArrowLeft, BsArrowRight, BsChevronUp, BsSun, BsMoonFill,
} from "react-icons/bs";
import { type IconLibrary, iconNames } from "../../../../lib/studio/projectConfig";

/**
 * The glyph each library draws for each icon name, in lib/studio/iconCatalog's
 * order (the Dart compiler draws the same ones from the Flutter packages).
 */
export const sets: Record<IconLibrary, Record<string, IconType>> = Object.fromEntries(
  Object.entries({
    material: [
      MdShoppingBag, MdMenu, MdClose, MdSearch, MdPerson, MdHome, MdReceipt, MdStar, MdAccessTime, MdAdd, MdRemove, MdChevronLeft,
      MdChevronRight, MdExpandMore, MdSettings, MdLocationOn, MdFavorite, MdEmail, MdCheck, MdShoppingCart, MdLocalShipping,
      MdCardGiftcard, MdLocalOffer, MdCreditCard, MdPayments, MdLocalCafe, MdPhone, MdChat, MdNotifications, MdInfo, MdWarning,
      MdHelp, MdThumbUp, MdLock, MdVisibility, MdEdit, MdDelete, MdShare, MdRefresh, MdLogout, MdPhotoCamera, MdImage, MdList,
      MdGridView, MdCalendarToday, MdMap, MdNavigation, MdArrowBack, MdArrowForward, MdExpandLess, MdLightMode, MdDarkMode,
    ],
    feather: [
      FiShoppingBag, FiMenu, FiX, FiSearch, FiUser, FiHome, FiFileText, FiStar, FiClock, FiPlus, FiMinus, FiChevronLeft,
      FiChevronRight, FiChevronDown, FiSettings, FiMapPin, FiHeart, FiMail, FiCheck, FiShoppingCart, FiTruck, FiGift, FiTag,
      FiCreditCard, FiDollarSign, FiCoffee, FiPhone, FiMessageCircle, FiBell, FiInfo, FiAlertTriangle, FiHelpCircle, FiThumbsUp,
      FiLock, FiEye, FiEdit2, FiTrash2, FiShare2, FiRefreshCw, FiLogOut, FiCamera, FiImage, FiList, FiGrid, FiCalendar, FiMap,
      FiNavigation, FiArrowLeft, FiArrowRight, FiChevronUp, FiSun, FiMoon,
    ],
    bootstrap: [
      BsBagFill, BsList, BsX, BsSearch, BsPersonFill, BsHouseFill, BsReceipt, BsStarFill, BsClock, BsPlus, BsDash, BsChevronLeft,
      BsChevronRight, BsChevronDown, BsGearFill, BsGeoAltFill, BsHeartFill, BsEnvelopeFill, BsCheck, BsCart, BsTruck, BsGift, BsTag,
      BsCreditCard, BsCash, BsCupHot, BsTelephoneFill, BsChatFill, BsBellFill, BsInfoCircle, BsExclamationTriangle, BsQuestionCircle,
      BsHandThumbsUp, BsLockFill, BsEye, BsPencil, BsTrash, BsShare, BsArrowClockwise, BsBoxArrowRight, BsCamera, BsImage, BsListUl,
      BsGrid, BsCalendar, BsMap, BsCursor, BsArrowLeft, BsArrowRight, BsChevronUp, BsSun, BsMoonFill,
    ],
  }).map(([library, icons]) => {
    if (icons.length !== iconNames.length) throw new Error(`The ${library} icons and lib/studio/iconCatalog disagree.`);
    return [library, Object.fromEntries(iconNames.map((name, index) => [name, icons[index]]))];
  }),
) as Record<IconLibrary, Record<string, IconType>>;
