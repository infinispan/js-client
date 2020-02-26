var _ = require('underscore');
var utils = require('../lib/utils');

var t = require('./utils/testing'); // Testing dependency

describe('Murmur Hash v3', function() {
  var strings = [
    {expected: 0x7C968B75, input: [-124]},
    {expected: 0x66349ADC, input: [ 122,   82]},
    {expected: 0xC29925E0, input: [ 113,   16,   69]},
    {expected: 0x85C121DA, input: [   3,  111,  110, 101]},
    {expected: 0x1ADDB01E, input: [ 103,  -53,  -50,   37]},
    {expected: 0x0A853868, input: [  40,  -87,  -11,   65, -128]},
    {expected: 0x069DB0FA, input: [  35,   45,  -107, -83,  126,  126]},
    {expected: 0x1AC80763, input: [  28,  -83,  -61,   -6,  -99, -125,   84]},
    {expected: 0xB26FE53F, input: [  56,  -48,   52,  122,  -48,   -8,  -12,    8]},
    {expected: 0x121068A0, input: [  79,   13,   28,   33,  -56,  111, -111,   53,   53]},
    {expected: 0x3EB93516, input: [  51,   47,  -91,  -69,   15, -115,  -82,  110,  -55,   67]},
    {expected: 0xEA3408EB, input: [  43,  -45,  126,   26,   14,   55,  -69,   32,  100,   49,  103]},
    {expected: 0xFD08CD6B, input: [  65,    2, -121,  -57,  -88,    3,  -92,   -9,  -13,  -27,  -68,  -74]},
    {expected: 0xA63F2F5A, input: [ 113,  -37,   66, -107,  122,   -1,  -88,  114,   72,  -20,  -95,  123,  -92]},
    {expected: 0x388A847B, input: [ 117,   10, -105,  -44,   -5,  -41,   37,  -98,  123,  123,  -70,  -56,  -30,  -63]},
    {expected: 0x2FBEEAC4, input: [ 100, -102,  -27,  -63,  -65,   -8,   -5,   49, -101,   11, -116,  -10,   65,  -34,   79]},
    {expected: 0x2D5568C7, input: [ 122,  -70, -104,   94,  124,  -82,   26,   77,  123, -109,  113,    2,  -71, -102,  -61,  -35]},
    {expected: 0x8F506F52, input: [ -72, -103,   67,   71,  -67,  -67,   96, -112,   86,  102, -109,  103,  112,   79,  -58, -119,  -72]},
    {expected: 0xC87BBDF1, input: [  12,  -30,   56,  -75,  -88,   49,  118,   92,   13,  -92,   52,  -14,  -98,   71,  -96,   20,  -97,  -69]},
    {expected: 0xDCAC965F, input: [ -24,  -73, -107,   -2,  -79,   19,   12,  -49,   36,    5,   48,  -76,   50,  121,   53,  -77,  -79,   80,   75]},
    {expected: 0xAA62D68E, input: [  35,   60,  -50, -100,  -96,  -40,  -30,   40,   79,   25,  -77,  -28,    3,  108,   87,  -46,  -34,  -81,  103,  119]},
    {expected: 0xE034770E, input: [  80,   45,  -11,   86,  -30,  -48,   20,  -48,   47,  -75,  127,  -77, -125,  104,  -34,  -29,   66,    2,  111,  119, -113]},
    {expected: 0x09AE47BF, input: [ 122,  104,   99,  -97,  -25,   47, -128,  100,  -77,   68,  -27,   28,   78,  -91,  -74,  121,   -1,  -10,   77,  113,   88,  -86]},
    {expected: 0x0B9BE6A1, input: [ 114,   25,   78,  126,  -54,   79,  -73,   86,  -22,  -21,   25,   61,   34,  117,  -87,  -47,   49,   29,  -43,  -67,   91,   10,   24]},
    {expected: 0x42995FE1, input: [  77,   65,   55,  -92,  115, -109,  102,   42,   14,   31,  -15,   18,  -52,  106,  -43,  -98,    0,   77,  121,  -93,  -16, -116,  -57,  -78]},
    {expected: 0xB1955372, input: [  31,  -75,   49,   40,  125,  -93,   87,  118,   22,  -87,  -23,  -70,   13,  -74,    6,  102,  -28,  -47,   84,   28,  -30,  -77,   15,   42,   -1]},
    {expected: 0xF82381F8, input: [ -79, -122,   30,   33,   43,  -59,   69,   93,   -5,    2,   56,   21,   65,  -14,   27,   11,  -15,   33,   49,  -90,   83,   99, -118,  127,    7,   48]},
    {expected: 0xA98F9EF5, input: [  63,  -67,   75,   63,  -42,  -98,   87,   42,   74,  -85,   64,   56,   35, -122,  -99,  121,  126, -103,  -36,    1,   31,  117,   73,  -63,  104,   35,    1]},
    {expected: 0x52621188, input: [  14,  -38,  -13,  127,   97,   29,  -79,   49,    0,  -32,   31,   34,  -27,  -51,  -78,  -76,  -53,  -18,   95,  -94,  114,   78,   10,  -72,   36,  118,   19,  -66]},
    {expected: 0xDACDEC02, input: [ -53,  -73,    6,  101,   95,   60,  -68,  117,  103,   55,  -19, -103, -112,    2,   17,   26,  -68,  -67,  -28,  -22,  101,   44,  -49,  -33,  -41,  -78,   28, -105,  -23]},
    {expected: 0xDEDE67D6, input: [ -97,  -79,   45,  -10, -117,  115,   95,   10,    6,  -33,  -43,    6,   60, -104, -121, -104,  -63,   76,  123,  111,  -11,  104,  -23,   34,  113,  -13, -108,  -29,  -65,  -64]},
    {expected: 0x39638833, input: [ -87,   -2,   24,  -89,   12, -112,  -94,   40,  -39, -110,   38,   22,  -41,   75,    1,  -13,  -92,  -27,  -83,   11,  -52,   37,  -53,   -4,  107,   96,   48,  120,  -88,   18,  -32]},
    {expected: 0x76E447F1, input: [   5,  -20,  -98,   33,  -78,  120,   43,  -49,  -25,  -85,   27,   55,  116, -120, -128,  -72,   24,  -45,  -92,   58,  -84, -112,   52, -113,  -55,   64,  108,  -80,  -76,   31,   47, -114]},
    {expected: 0xEC6E6ABD, input: [ -51, -109,  -80,   56,  -77,   23, -115,  -35,  -49,   36,    8,  -11,   20,  -67, -127,  -40,  -64,    4, -114, -118, -119,  -12,   96,  105,  100, -109,   65,  -96,   -5,   52,   23,   10,  -50]},
    {expected: 0x6A7A4AE0, input: [ -31,   39,  -29,  -51,   70,  110,    0,   38,  -85,    0, -100,   61,   -3,    4,   58,  -97,  -67, -111,  -51,  120,   19,   51,    3, -124, -115,  -29,  -37,  -63,  -95,  -96, -128,  101,   10,   20]},
    {expected: 0x2E678E65, input: [  57,   96,   10,  125,   98,   25,   -1,  -63,  -93, -112,  -51,   63,  -21,  -44,  -23,  115,  -98,  109,   73,  -45, -109,  -28,  -46,  -43,  -55,  -16, -102,   38,   38,  -66, -119,  -11,  -75,  111,   97]},
    {expected: 0xE9D5D73D, input: [  46,   62,  -26, -107,   82,  106,  -74,  -20, -127,   51,  -30,   94,  -20,  -31,  -73,   13,  -26,  -85,  -39,   90,   35,  -25,    6,  -20,   69,  -51,  -59,  118,  -66,  -56,  -35,   76,  -47,   19,   -6, -113]},
    {expected: 0x860E8408, input: [  13,   61,   11,    1,   44,   85,  -66,  -92,  -72,  -77,   98,  -38,   -4,  112,   27,   47, -118,  -11,  117,  -46,   63,  104,  114,   93,   24,  -71,   15,   51,  115,  110, -127,  -41,    0,   73,  -55,   47,  -98]},
    {expected: 0x5E62DA49, input: [ 122,  116,  115,   39,  -49,   60,  -90,    6, -107,   57,  124,   54,   70,  -66,  -16,  127,    9,  -37,   11,   87,   60,  112,   18,    5,  -57,  -26,  -52,   40,  -18,   64,   29,  127,   92,  -46,  119,  -96,    7,  -11]},
    {expected: 0x992FF745, input: [ 102,   83,  -74,   67, -127, -102,  -70,  -43,   -1,  -43,  -50,  -94,  -35,  -78,   97,   86,  -13,   84,  -16,  -59,   27,    9,   -8,  125,  -29,   -5,   32,  -87,  -56,  -95,   52,  -25,   33, -105, -121,   38,  -28,  -30,  -38]},
    {expected: 0x830C50DE, input: [  61,  -90,  -48,   78,   47,   11,   41,   52,  -59,   50,   61,  -96,  -54,   36,   23,   65,    0,  107,   97,  -25,   36,  -93,  -76,   56,   -9,    7,  121,   79,   51,  -35,  123, -106,  110,   -5,  -63,  -21,   52,  109,  -83,  -79]},
    {expected: 0xF46BF233, input: [-108,   24,  -74, -114,    7, -116,  126,   50,  -18,  -68,  -80, -109,  -89,  -28,  -28,  125,   31,   34,   47,   69,   91,  -69,   54,   49,  -11,   58,  -16,  -87,   17,   66,   -5,  118,  121,   51,   25,  -95,   56,   96,  -61,  -82,   68]},
    {expected: 0x8F8E45EB, input: [ -79, -118,   63,  -59,  -77,   36,  120,   23,   11, -100,   56,  -98,   81, -123,  -59,  -41,   29,  109,  -17,  125,  112,  -79,  -69,  106,   12,   60,  -74,  117,   91,  -72,  -37, -120,  -94,   16,  -12,  -59,   -7,   48,  -70, -106,   45,  125]},
    {expected: 0x1DFB3792, input: [  16,   39,  -78,   81,   -5,  -70,  112,   24,  -60,    3,  -61,   31,   16,  -20,  -99,  -49,  124,  -35,  -54,   83,   92, -123,  111,   39,    6,   57,   10,  108,   -7,  -59,   26,   29,  -91, -101,  -40,  -27,   89,   69,   67,   71,   -6,  -45,  -89]},
    {expected: 0x0A55C49B, input: [  80,   95,  -71,   28, -123,  -28,  -87, -122,  -42,   98,  120, -121,  -88,  -75,   35,   16,   56,  -85,   66,  102,   18,  106,   23, -102,  117,  -64,   76,   82, -104,  -44,   95,  -28,  -54,  -75,   77, -114, -123,  -88,   54, -108,  -48,   44,   81,   81]},
    {expected: 0x339A4959, input: [ -11,  117,   51,  -79,   60, -101,   79, -107, -128,  105,   98, -115,  -61, -115,   51,   26,  113,  -97,   81,  -50, -122,   77,  -46,  -87,  -93,   96,  123,  -38,  124,  106,  100, -124,  125,  116, -119,  116,   46,   15,  -99, -108,  107,   28,  -48,   54,   79]},
    {expected: 0x159CCF87, input: [ -39,   27,   23,  -94,  -64,   71,  125,  -88,   95,  -22, -122,  -26,  -75,  122,  121,   -8,    0,   36,  -16,  -94,  -45, -109,   99, -106,  -31,   60,   58, -115, -108,   82,   35,  -77,  101,   73,  -83,  -78,  -75,  -25,  120,  100,   63,  -31, -102,  -47,   39,   18]},
    {expected: 0x2A676A65, input: [  60,  -51,  -77,   96,   47, -113,   19,  121,  101,    1,   52,   37,   98,   54,  119,   58,   86, -123,  -90,   79,   75,   91, -113,  -56,  101,  -83,   45,  -70,  126,   -4,  -33,  -44,  -87,   96,   62,  123,  -58,  113,   55, -103,  -36,   55,   26,  -18,    3,  -70,   88]},
    {expected: 0xE2A58BD4, input: [  49, -103,   95,  124,  126,   39,  -92,   94,  -95,   46,    9,  126,  -97,   11,  111,   37,   56,   44,  -89,   63,   40,   53, -101,   25, -110,   -3,  -29,  -56,   23,  -31,  -34,  -40,  -37,   38,  127,    5,   12,   59,   47,   18,   78,   46,   46,  127,   50,   53,   74,  -33]},
    {expected: 0x3A065610, input: [ -47,  -27,  -50, -100,   43,  107,   21,  124,  101,  100,   57,  -45,  127,   70,  -41,   44,  -81,   47,  118,   32, -123,  -32,   39,   85,   47,  -51,  -45,  -98,   63,   65,   54,  -88,  -22, -119,   33,  -69, -110,   51,   20,   72,   36,  102,   16,  -27,  113,   70,   79,  106,  124 ]},
    {expected: 0xC741B1C9, input: [ -57,  122,   10,   -7,  -99,   94,  -45,   69,   37,   51,   91,   78,  -63,   30,    0,   22,  -20,  -39,   40,   -7,    9,  -42, -125,  -80,  -97,   -7, -122,  -34,   24,  -14,   50,   39,  -99,  -47,  -87,  108,  -91,   15,  123,  -75,   31,  -42,  125, -103,  -36,  -77,   13,   46, -101,   67]},
    {expected: 0x8E99C0D1, input: [  34,   71,  -45,  109,  124,   13,   65,  -49,   96,   44,  -15,    3,   43,   12,   34,  -51,   -9,    6,  122,  -52,   56,    8, -116,    9,    9,  -33,  102,   51,  114,   76,   30,  -67, -120,  112,   27,  -18,  -87,  -60, -104,   59, -117,   48,  -14,  127,  -43,  -93, -124,  -23,   16, -121,   68]},
    {expected: 0x79BF49DB, input: [  21, -101,  -48,  -67, -111, -124,  -99,   68,    1,  -68,   34,   83,   10,  -84,  -73,   32, -113,  -62,  -44,   85,  -73,   94,  -65,  -90,   68,   46,  -62,    2,  122,  112,  117,   83,   20,   -7,   11,   24,   26,  -13,   31,  -97, -128,  -32,   89,   97, -127, -117,  -13,  100,   42, -123,  -71,   15]},
    {expected: 0x151CD0B4, input: [-118,   68,  107, -119,  -60,  -79,   32,   41,  125,  -58, -106,   79,    8,  127,  -27,   41,  -35,   37,   -2,   94,  -69,   85,   79,  -46, -101,  -18,   81,   32,  -92,  -71,    0,  127,   53,   26,  -40,   25,  -67,   33,  126,   98,   -8,   -8,   29, -110,  -43,  -63,   68,  -80,   -1,  -61,  119,  117,   84 ]},
    {expected: 0x6DC5E586, input: [  60,  -49,   67,   76,  -23,   26,   38,  -54,  -31,  -19,    5,  -29, -115,   55,   -7,  127,  -77,   10,  102,  126,  -54,   40,   47,   61,   50,  -90,   46,   40, -100,   36,  123,   59,   36,   58,   49,  -58,   68,   -6,  -79,   13,   39,  -75,  -38,   77,   -1,   96,  -93,   56,   10,  108,    8,   64,  -93,  -16]},
    {expected: 0xB59079E1, input: [  44,   68,   32,  -43,  107,  -42,  -61, -106,   16,  -79,  -37,  -99,  102,    6,   75,   68,  -96,  -91,   -8,  -62, -116, -107,  111,   12,   31,  -52, -128,    6,  -31,   64,    2,   69,   99,   61, -109,  -31,  124,  -27,  -23,   84, -116,   15,  -39,   59, -125,  -63,  122,  -65,  -96,  -87,  -38, -113,   48,  -95,  -19]},
    {expected: 0x8F7FC057, input: [ -76,   79,  -80,   81,  -25,   87,   25,   14,  -60, -113,   -3,  -75,   -8,  -57,  -44,  126,  -74, -124,  -33,  -64,    6,   33,   47, -104,  109,  -62, -125,  -15, -110,  -44,  102,    9, -115,   64,   84,   18,  -19, -127,  -31,  -46,   83,   15,  -70,   27, -122, -126,   65,   24,   37, -113,  -78,  115, -118,   25,   34,  -80]},
    {expected: 0x4DF5A062, input: [ -46,   -1,   84,  -65,  -72,  -88,  -75,  -48,   38,   18, -110,    1, -103,  103,  -92, -103,   88,  -55,   18, -106,   41,   46,   27,  -98,   52,  -25,   72,   56,  -52,   98,    3,  117,   70,   42,  -63, -106,  -17,  115,   -8,  -59,   41,  -28,  -84,  -92,   19,   34,   -8,  -13,   58,  -59,  -70,  -22,  -10, -110,   23,  -72,   41]},
    {expected: 0x6AAD5C40, input: [  70, -127,  125, -110,   13,   29, -125,  -70,  -58,  -91,   64,   71,  -80,  113,  106,  -69,   82,   73,   72,  -31,   87,   42,  -36, -104,  -16,   90,    1, -113,  -80,  -50,    8,   86,  -96, -112,  -91,  -88,  -35,  -51,   16, -117,   91,   48,   87,   27,   -6,  107,  -61,   -4,   -2,    6,  -53,  -54, -114, -126, -118,  -51, -116,   11]},
    {expected: 0x6E7D9927, input: [  19, -119,   56,   37,  -97,  -33,   34,   -5,  119, -120,    1,   -1,  117,  -52,  -91,  -16,  -36,  -41,   43,  -24,  102,   42,  -90,    5,   64,  113,  -25,   37,   95,   41,  -49,    5,   64,  -90,   -3,   99,   65,   93,   -6,  -23, -106,   -3,  103, -117,   39, -103,   58,   57,  124,  -61,  -67,   70, -117,  -25,   72,   18,  -28,   30,  -83]},
    {expected: 0xC7B4555A, input: [  11, -128,  114,   45,  -14,   37,   90,  -36, -126,  -25,  -32,  120,   48, -109,   54,   41,  -21, -111,  -30,   31, -122,    8,  101,  -30,   92,  -91,   24,  -45,  -60,  -18,   52,   70, -112, -111,   39,  -50,  105,  -36,   42,  -86,   60,    9,  -43,  -15,  -78,   25,  -59,  -96,  -57,   80,   67,  -63,   54,  -87,  -10,  -31, -107,   -4,  -15,  -26]},
    {expected: 0x31B6AB6B, input: [  45,  -82,  -33,   -2,   30,   23,    1,  -73,   25,   -6,   82, -101,   78,   47,   75,  -13, -127,  -94,   20, -116,  -39,   88,   79,  -26,   54,   67,  100,   43,  127,  -49, -104,   22, -104, -123,  109,   47,  112,   -1,   51,   24,   18,    1,   67,  -90,  118,   62,   29,   72,   75,   78,  -57,  -37,  -78,  125,  -22,   -1,   25, -111,  101,  -84,   83]},
    {expected: 0xEEB994A4, input: [ 121,  -23,   73,  -60,   50,  -34,   75,  -17,  -58,  -14,   77,  -60,  -65,  113,  102,  -87,   25,  119,   66, -110,   71, -108, -114,  -51,  -31,   23,  114,   13,  118,   30,  -36,   -5,   31,  -25, -100,   51,  -18,   28,   57,  -93,  -52,  -74,    8,   23,   47,  -19,   -4,    1,   -9,   62,  -40,   44,   60,    8,   60, -126,  -58,  -45,   74,   72,   -5,  -40]},
    {expected: 0xEA69003D, input: [  13,   10,   91,   62,   78,   -2,  -26,  113,  -98,   71,   74,  -63,   43,   61,   64,   88,   99,  -24,    9,  -34,   12, -120,  111,  -69,  -80,   85,   71,  102,  -38,   82, -113,   74,  117,   53,  118,  112,   72,  -83, -123,  -97,  112,  -23,  104,  102,  -48,  -94,   34,  -95,  -48,  -13,  -28,  -15,   33,   66,  -32,  125,   36,   16,  114,  -67,  -63,  -65,  -14]},
    {expected: 0x510ED044, input: [ -20,  113,  -69,  -98,   33,  -97,  -92,   17,   53,  119,  -79,    2, -112,  -10, -120,  116,   21, -126,    6,   39,   78,   31,  125,    1,  -19, -102,   73,   76,   66,  -18,  -50,   90,  -25, -114,   81,  -88,    2,  -75, -116,   33, -110,   37,   52, -121,   13,  101,  -54,   -2,   67, -102,   28,  -14,  -13,   30, -125, -122,    1,  -46,  -80,   56,  -75,   -2,  115,   74]},
    {expected: 0x0E93EC5F, input: [  10,  -56,   -2,  -46,  -30,   86,   75,  105,   18,   67,  -24, -123,   19,   60,   78,   72,   44,  100,   92, -103,   86,  -27,   56,  -49,    3,   93,  -62,   65, -122, -110,   71,  -96,   89, -123,  118,   13,   86,  116,   11,   85,   -9,    9,   49,   88, -111,  -90, -102,  -69,   74,  -89,  -39,   36, -112,   82,  -55,   89, -128,   75,   79,  -52,   49,   17,  -22,   86,  -91]},
    {expected: 0x7E799351, input: [ -41,  105,   73, -113,  -34,  -69,   -2,  122,   10, -127,  121,  -75,   68,   19,  -88,  -31,  110, -110,    8,  -14,   16,   43,  -48,  -99,   -6,   90,   46,   25,   83,   65,  124,  -66,  106,   82,   77,  -57, -110,  -88,  -12, -110,  127,   23,   -4,   58,  -61,  104,  -49,   41,  -48,   43,  -75,  115,   28,  -25,   51,  111,  126,  -46,  -90,   99,  -68,   38,  -29,  -81,  -60,   54]},
    {expected: 0x57C3C7BC, input: [-119,  -45,   19, -106,   87,  -20,  110,  -43,  -88,   -6,   23,  -94,  -48,  -61,   48,  -40,   91,  127, -112,  -92, -116,  -78,   39,  -90,   59,   92,   67,   -1,   -3, -115,   45,  -31,  117,   85,   82,  -27,  -46, -112,   50,  -80,   63,   54,  -18,   98,   26,   -1, -128,   10,  122,  -78,   71,    6,  -71,  126,  -88,  -82,    5,  -49,  -24,  -68,  118,   89,  -27,   33,  -10,   17,  -94]},
    {expected: 0x8C91357D, input: [  64,  -38,  -70,  -37,   51,   93,   43,  -58,  -63,  -49,  118,   -3,   83,  -71,  -29,  -64,   74,  -44,  101,   84,  -13,   83,  -20,   19,  -62,   -2,  111,   11,  109,   63,  -32,   55,   84,  -51,  102,  -20,  -88, -115,   95,   58,   96,   19,  119,  -23,   -6,  124,   32,  -36,   55,  -90, -121,   -4,  -57,   59,   35,  100,   58,  -56,   10,  -54, -109,  -59,  -59,  -79,   13,  105,    6,   -6]},
    {expected: 0xADCDE131, input: [  73,  -11,   56,  -12,   29,   92,  -67,  -58,  -41,  -58,   -1,  -36,  -47,  -77,   20,  -18,   66,   14, -115,  107,   77,   65,   87,   60,  -43,  -88,  -88,   61,  -32,   10,  -12,  -91,   26,   44,   71,  -51,  -14,   47,   -3, -123,  -36,  -38,  -40,   54,   84,   96,  -62, -121, -116,   48,   75,  -42,  -59,  123, -103, -115,    3,   44,   36,  -73,  -96,   76,    9,  108,  -48,  -70,  -30,  -95,  125]},
    {expected: 0x7C92191A, input: [ -41,  -60,   61,  -37,   36,   92,  -81,   -7,  -93,  -81,  -22, -121,  -40,  106, -126,  -97,  -53,  -33,  -34,   16,  -72,   10,   97,   83,  123,  -21,  -30,   89,  -79,  117,   68,  -79, -113,   34,  -44,    6,  -24,   12,   76,   13,  -47,   57,   84,   82,   46,  -54,   -2,   -7,   29,  -55,   94, -101,  -49,  -12,  -93, -101,   83, -112,  -68,  119,   -7,   28,   51,   50,  -99,  -84,   48,  -87,   50,   25]},
    {expected: 0x97FFF41F, input: [-124,  -64,   -2,   69, -123,   32,   88, -124,   -5,   -8,  127,  -30,   37,  -12, -101, -127,   93,   32,  -94,  104,   66,   -3,  -74,  -11,   96,  -45,  -21,   72,   89, -105, -113,   21,   73,   75,  114,  120,  -47,  -16,  -29,   78,   39,   10,   94,    3,   79,   27,  112,  -79,   61, -124,   51,  -61, -108,   21,   89,  -71,  -67,  -58, -115,   82,   36,  -41,    9,   26,   88,  -37,  -77,  -37,   73, -107,   23]},
    {expected: 0x715F12C6, input: [ 107,   -7,   26,   -7,   84,  -55,   54,  -27,  -31,  -83,  105, -108,  -35,   86,   50,  -43,   22,  -23,  -13,  -65, -116,  -45,    7,  -21,  -66,   90,  -62,  -93,  126,  122,  -98,  -84, -119,  -27,   37, -115,   78,  102,   -1,  -34,  -24,  -58,  -18,   49,   37,   50,   13,  116,   73, -116,  -16,  -40,   94,   52,   -7,  -63,  118,   78,  115,   56,  122,   88, -109,  104,   53,  126,  -61,  -84,   94,  -83,  -79,   44]},
    {expected: 0x19304FFB, input: [ -42,  -48,   73,   63,   46,  -71,   65,  -36,  118,  -31,   43,  -78,  -17,  -64,    3,   42,  -44,  -62,  -55,   63,  -13,  -74,   14,   28,   66,   11,   14,   84, -116,  -29,  -29,   38,  -44,  -41,  -34,    2,  -42,   33,    1,  -84,   70,  -19,  -67,    8, -121,   49, -108,  -25,   38,   91,   23,  -65, -125,  -22,   42, -114,  -76,    0,  119,   54,  -70,  -44,  -23,  -50,  -93,  -60,   95,  -25,   25,   96,   95,   72,   68]},
    {expected: 0xB1E88507, input: [ -29,   93,   69,  -60,   26,  120,  -82,   -9,   39,  120,  107, -103,    1,  -53,  -62,  -79,  -23,    3,  -78,  -14,  -42,   36,   -3,   64, -121,  122,  -18,   25,   39,  -69,   68,  121,   54,    8,   79,   35,   -6,   87,   71,  -14,   60,   -8,  -88,   68,   24,   70,   38,  -21,   67,  117,    6,   72, -118,  -47,    8,   34,  -49, -113,  -17,  -45,   52,  -73,   -9,  -53,  -44,  -57,  -67,   87,   78,  -16,  105,  -93,   38,   -7]},
    {expected: 0xBA1C7AA3, input: [ -83,   -5,   80,  -44,   47,   18,  -65,  -39,   55,  -58,  -30,  -54,  120,  -95,  -53,  -20,   50,   14, -124,   90,  -75,  -98,   19,   38,   15,  -17,   28, -119,  -31,  -98,  -93,   98,   51,  -58,  -33,  109,  -54,  -59,  116,    1,   44,  -17,  -46,  -51,   63,   -4,  124,   18,  -37,  -19,  -28,  -72,   36,   51,  -56,  -48,   77,  -42,  127,   30,  124, -126,   38,   36,   62,  100,  -71,  117,   65,  126,  124,   97,  126,   83,   84]},
    {expected: 0x73927F86, input: [ -87,  -12,  121,   19, -119,  -88,  -66,   93,  -64,   71,   76,   11,  -42,  -89,   24,  -81,  -62,   50,   93,  -83,  114,  119,  -32,   98,  -65,   -5,   11, -127,  -34,  126,  -80,   20,   -8, -109,   48,  -37,  -73, -112,  116,   -4,  -98, -100, -117,   43,   29, -125, -127,    3,  -69,   27,   -8,  100,   87,  -97,   15,   82,  108,  -88,   -4,  -76,    1,  -21,   41,  106,  -60,   70,  -15,   49,   65,  -90,   86,  121,   57,  -22,   27,   76]},
    {expected: 0x1F3176FB, input: [ 117, -128, -121,  117,  -36,  -86,  122, -112,   12, -110, -116,  120,   40,   73, -101,  -78,   18,  -21,    7,    7,  -87,  -83,  -53,    6,  115,  -35,   87,   58,   68,   51,   15,   48,  -36,  -12,   13,   30, -110,  -90,  -13,   75, -111,  103, -103,   93,   58,  -85,  -34,  -39,  -99,  -93, -107,  -30,  -13,   46,  -72,  118,   61,   31,  -84,   50,  110,   72,   11,  -77,  104,   85,  107,   52,   42,  114,   72, -116,   26,   28,  119,  102,  -22]},
    {expected: 0xBD9940CF, input: [ -72,  -34, -124,  -28,   28, -126,  -28,   50,  -50,  -25,  -32,   35,   56,    6,   34,   41, -125,  -85,  113,   89,   35,   84,    0,  -39,   14,   -6,   -3,  -62,   93,  -78,  -87,  -55,   53,   81,  -73,  -79,  -54,   92,  -54,  -56,    4,   36,   22,  -49,   16,    4,  -82, -116,   35,   41,   22,  -44,  -67,    2,   84,  -20,  104,   84,   29,    0,  -35,  -45,  -19,   77,  103,  125,  -66,   28,   79, -103,  -49,  -20,   32,  -21,   21, -105,  -58,   85]},
    {expected: 0x7AE339D1, input: [ -42,  -59,  -39,  -59,  -32,  -54,  -78,   60,    1,  -60,  110,  119,   46,  109,  -57,   18,   58,   67,   22,   55,   43,  -78,   -6,  -78, -120,  -79,  -89, -114,  -56, -104,   22,   11,   78,  -77,  -26,  116,  -52, -121,   -2,  -90,  -64,   -1,   96,  -53,  111,   82,  -66,  107, -115,  -95,  124,   89,  -48, -122,  110,  -50, -123,  118,   67,   10,   94,  -39, -101,  -98,   41,   12,  116,   67,  -19,   99,  -55,  -28,   35,   92,  -15,   74,   44,  121,   -3]},
    {expected: 0xAA5F5271, input: [ -84,   42,   46, -112,   63,   27,  -80,    6,  123,   42,   94,  -85,  -16,  -89,  -16,   95,   33,  106,  -94, -128,    7,  120,   44,   14,   18,   -3,  -39,  -94,   50,   10,  -47,   -3,  -12,    6,  125,   68,  -63,  104,  -81,  109,    1,   74,   57,   28,   -3,    2,  -73,   66,   39,  -13,   64,   -7,  -52,  -15,  -92,  -61,   10,  -54, -116,  -20, -106,   54,   78,   64,   28,  -45,  -53,   25,   52,  -76,   56,  -20,  -67,  -10,  102,  -52,  -60,   84, -117,  -64]},
    {expected: 0x987AF19D, input: [ -40,   68,  -94,  122,  125,   17,  -68,  -25,  -11, -115,  -76,  -88,   77,  -56,  -95,  -95,  -98,   36,   51,  -95,  -27,   77,  -24,  -26,   15,   21,   48,  -23,    6, -108, -118,  122,  -68,  -87,   -2,   44,   87,  -46,  -23,   24,  -71,  -70,  126,   64,  -53,   11,   42,  -56,   93,   51,  -77,  101, -101,  -34,  109,   23,   96,   49,   39, -102,   34,   88,  103,   35,  -77,   57,  -77,   78, -106,   43,   44,   13,  -79, -119,   11,   34,   80,    2,  -63,   42,  -22]},
    {expected: 0x6AE71BE6, input: [ -63, -107,  -84, -109,  120, -123,  -11,  -84,    0,  -22, -120,   43,   -7,   62,   60, -102,   51, -123,  -29,  -23,  -11,   59, -116,   51,   87,   40,   -7,   -3,  -65,  -68,   29,  -73, -112,  -84,  -83, -123,   -7,  114,  -40,   40,   50,  -15,  105,   31,  -63,  -13,   36,   46,   62,   -7,    0,   32, -125,   93,   89,  112,  125,   72,   47,   76,    6,  -60, -118,  -72,    6,  -21,  -95,   38,  109,   90,   77,  120,  -14,  -51,   15,  -72,  -91, -100,    0, -115,   -2,   71]},
    {expected: 0x28853389, input: [  68,  -95,   96,   98, -109,   26,   33,   39,   44,  104,  -60,   -8,  -90,   -8,   93,  -48,   56,  -88,  -44,    3,   32,  -19,  -84,   98, -127,  107,   11,  114,  -10,   -3, -114,  102,  -13,   28,  -62,   80,   10,  102, -117,  -69,  -31,  -31,  -60,  -54,   82,  -99,   -6,   50,    0,  -63,  -43, -125, -100,   95, -115, -100, -107,   -8,   31,  -49,   63,   82,   82,  -77,   54,   -4,   37,   50,    5,  -39,  112,  -52,   23,   71,   68,   53,  125,  -32,   96,  -33,   31,  -79,  -26]},
    {expected: 0x57A78D9C, input: [  87,  126,   20,   61,   20, -114,   45,   56,  -85, -120, -112,  -91,  -86,    1,   34, -113, -110,    9,   98,  -62,  -49,   -4,   38,  -62,  -76,   43,  114,   62, -103,   -3,  -60,   86,   94,   33,   51,   93,   59,   67,   55,  -63,   47,   52,   58,  -23,   67,   28,   89,   13,   29,    3,   80,  115,  118, -128,  -35,  -83, -126, -124,  -43,   25,  -28,   84,  -33,  -54,   66,   89,   79,   58,  119,   75,   37,   57,  -54,  -27,  -46,  112,   92,  -45,   13,  -47,  -18,  120, -111,  -66]},
    {expected: 0x87FB8D12, input: [ 124,  -16,  -35,   76,  -93, -125,   40,   24,   58,   29, -127,  -84,  -53, -120, -127,   68,  -75,  -90,    0,  -70,   75,  -28,   13,  -60,  -58,  -54,  -59, -126,    3,   34,  -62,  106,   36,   85,  -59, -123,   60,  -75,  -38,  100,   11,  -19,  -43,   -9, -108,  103, -112,  -68,   -3,  119,    9, -116, -114,  -38,   48,  -56,  102,  119,  -37,   58,   93, -128, -111, -121,   -4,   31,  -33,  -28,  -86, -120,  -37,  -76,   27,   39,   52,    5,  -79,    5,  -80,   38,  123,   58, -104,   77,   42]},
    {expected: 0x83C42348, input: [  93,   42,   61,  -18,  -64,   -6,  -78,   67,  -35,  -11,   42,   73, -117, -127,  121,  -20,  -70,  -73,   97,  -65,  -88,  -76,  -73,  -72,  114,   75,  -16,  124,    1,   31,   28,  -82,  -41,  -43,   32,  -77,   58,  -41,   20,   55,   84,  -79,  -87,  -65,   89,  -55,   -8,  -53,   83,   34,  -83,  102,   69,   55, -105,  -71,  -80,   93,  -37,  -19,   59,  -61,   87,  -35,   58,  -19,   98,   27, -102,  -83,    1,   10,   56,  -88,  -47,  -31,   61,   69,  -79,   89,  -69,  118, -106,    8,  -74,  113]},
    {expected: 0xD571269A, input: [  98, -104,   73,  -25,  -96,  -49,  119,   35,  101, -126,   19,   52, -125,   29,  -69,   -3,   68,  -95, -124, -123, -104,  -94, -101,  -19,  -51,   44,   97,  -93,  -47,  -26,  107,  124,  124,   84,   34,  -19,   84,   30,  -75,  -70,   11,   62,  104,   77, -123,  104,  -47,   12,  -83,  -30,  -80,   52,  -52,  -60,    9,   10,   93,  -25,  119,   14,   89,   37,  -68,  102,  -39,  -71,    2, -125,    4,  -65,  -73,   95,  -45,  -21,  -14,  -61,  -63, -107,   69,  -93, -102,   67, -121,  -86,   71,   96,   16]},
    {expected: 0x639B9C0A, input: [ 123,  -76, -112,   69,  -28,   37,  -59,    4,   63,  -55,  -11,   77,  113,   18,  -41,  -44,  111,   -9,   -1,   41,  -62,   19,   -7,  -86, -115,  -74, -120,  102,  125,   16,   60,  -74,  -39, -116,   40, -111,   90,  113,  106,   32,   47,   60,  -99,  115,  -26,  -51,   38,  -36,   12,  100,  125,  -91,    3,  -22, -112,  101,   93,   85,   47, -127,  -45,    9,   70,   77,   -7,  123,   17, -103,   97,   43, -120,  -46,    1,  -24, -107, -104,  -71,  -54,  -40,  112,    9,   66,  -17,   85,  101,  -85, -126,  112]},
    {expected: 0x8182D256, input: [ -19,   11,  -11, -119,   24, -108,  -40,   10,   89,   55,  -70,   39,   72,   -3,   92, -115,  -68,  -26,  100,  -21,  -64,  115,   79,  112,  -17, -116,  -26,   11,  -67,   -1,  -72,  -59,   35,  -20,   25,   86,   17,  -81,   42,  -43,  -27,   31,   23,   52,  -42,  106,   73,   29,  -73,   50,  115,   59,  -77,   90,  100,  -33,  -91,   50, -125,  -33,   81,  113,   25,  -18,  120,  -13,  -77,    0,  -74,   23, -126,  -16,  -95, -104,   92,  -90,   75, -103,   10,  -67,  -86,  -92,  -84,   50,   35,  -61,  -93,  -39,   57]},
    {expected: 0xD384604C, input: [  79, -110,  -35, -119,  -19,  -46,   60,  -70,   30,  -59,  -18,   97,  -31,  -98,  -44,  -81,  -72, -115,  -99,  -37,   45,   55,   17,   73,  -57,   19,  -38,    1,  -16,   -1,    3,   78,  -26,  -97, -104,   74,  -93,   64,   33, -107,  -77,  107,   89,  -49,   20,  -47,  -41,   64,  -73,   72,  -37,   17,  -61,  -82,  125,  -41,   47,  -79,  -63,   57,  -86, -126,    9,  -93,  -84,  -98,    6, -115,  -69,  -18,   45,   88,   51,  -73,  -58,  113,  -66,   98,   31,  -35,  -77,   98,  -68,  -81, -115,   77,  109,   66,  -88,  127]},
    {expected: 0x78CC1979, input: [  99,  -40,  126,  115, -101,   67,   96, -100,   52, -102,  113,   48,   52, -126,  122,  -73,  -14, -115,    7,  -99,   77, -110,   62,  -54,   70,  113, -125, -120,   -8,   57,  -26,  -85,   62,   70,   69,  115,  111,  -49,   53,  -12,   80, -127,    5,  -45,   24, -120, -117,   33,  -73,  -79,  -68,   29,  118, -128,   60,   54,  -50,   79,  -72,   85,  105,  -56,   17,  -55,   34,   21,   95,   23,  -50,  111,  -64, -110, -119,   55,   16,  103,  -75,   99, -118,   47,   99,  -11,  -29,  -43,  -31,   73, -120,   24,  -80,  -95,   75]},
    {expected: 0x0EE9EE11, input: [  -9,   57,  -13,  -55,  114,   53,  -38,   45,  125,   33,  -30,   -8,  -69,   66,  -15,  -82,  -89,  118,   87,   99,   24,    4, -107,  -65,   76,    1,  -30,  -15,   92, -100,  -60,  112,   29,  -39,  -45,   17,  -57,   37, -100,   75,   82,    1,   43,  -59,  -30,   23,   35,   15,  115,   12, -123,  -97,  -65,   43,   81,  -42, -107,   66,   64,  -12,  110,   -5,  -92,   31,  -37,   -9,  -79,  -84,   93,   26,   82,    4,  -42,   82,  103, -103,   -2,   66,  -67,  -40,  -28,  -51,  -76,  -30,    1,  -92,   39,  122,  124,   15,  111,  -43]},
    {expected: 0x173C334C, input: [  12,  -24,  -70,  -42,   -6, -104,  -92,   99,   22,  -47,  -16, -126,   92,  -33,   59, -107,   -7,  -57,   15,  -19,    0,   51,  -29, -101,   49,  -98,  -37,   66,  116,  -95, -126,  118,   96,   57,    0,   -3,   42,  -99,   53,  -73,   97,  123, -115,   65,  -66,   -3,  106,  -69, -109,   -2,  -32,   20,  124,    8,   24,   95,   63,  -50,  -50,   13,  -73,   22,  -24, -126,  -33,   37,   78,  106,  127,   47,  120, -120,   93,  -64,   14,   56,   73,  -81,   11,  -76,   95,  -15,   61,  -16,   33,  -82,  -17,  111,    1,    8,  -88,   -5,   31]},
    {expected: 0x5CC3057E, input: [  73,  -95,  102,  119,   -6,  -81,  125,  -45, -117,   52,   28,  113, -124,  -21,   65,  -88,  -43,  -38, -103,   65,   10,  109,  -32,   71,   18,  110,  -18,   43,  -61,   85,  -30,   63,  -14,  -46, -107, -125,  105,   34,   88,  123,  -71, -128,   32,  -59,  -38, -123,   67,   69,  -36,   49,   80,   -7,  -97,  -93,   55,  -30,  -63, -107,   67,  109,   32,  -49,  -59,   42, -122,   63, -106,    8,  -26,   81,  -70,  -41,  -93,  107,   15,   35,  -77, -124, -111,  -96,  117,   33,  -17,   47,  -57,  -43,   83,  -76,  -91,   54,   38,   60,  -37,   60]},
    {expected: 0xF6B36CB0, input: [ -59,  127,  100,   32,  102,  -70,  -97,  -80,  -13,   56,   17,   26, -122,  -60,  -75,  -46,   11,   33,  -52,   39,  -71, -107,   15,   78,   16,   14,  -26, -123,  -33,  -62,  -77,  -39,   17,   37,  -64,  -36,  -97,   76, -119,  -99,  117,  -91,   14,  -12,    5, -120,  -40,  -95,  125,  -23,  -50,    7,   22, -123, -127,  104,   24,  -81,  106,  -16,   43,  123,  -51,   60,   75,   65,  -44,   35,  -13, -118,   -4,  -36, -125,  -14,   49,   67,  -93,   19,   42,   -2,  -77,   17,  -23,   74,   40,  -79,  120,    0, -112,   61, -121,  -74,   85,  -13, -120]},
    {expected: 0xA0C76E85, input: [ 100,   -6,  -19,  -37,  -25,  114,  -72,  108,   22,  125,  -74,   69,  -35,   37,   84,   79,  124,  -38,  -24,  -39,  -47,  102,   89,  -40,   21,  -94,  -47,   75,  -67,   -9,   53,   65,   23,  102,   29,   75,  -70,   23,  -68,  -79,  -62,   72, -104,  -32,   78,   13,  -10,   53,  111, -119,  -80,  -12,   27,  -64, -123,   12,   25,  102,   36,  -11,   45,  -21,   97, -108,   20, -125,   70,  -42,   10,   45, -107,  102,   -4,   82,  110,   85,   -2,    9,   58,  122,   52,   25,   68, -127, -100,  -38,  -44,   98,  114,  -95,  -52,   12,   73,  -26,  -25, -111]},
  ];

  it('can hash encoded Strings', function() {
    var mh3 = utils.murmurHash3();
    _.forEach(strings, function(string) {
      expect(mh3.hash(Buffer.from(string.input))).toBe(string.expected);
    });
  });
});

describe('A replayable buffer', function() {
  it('can have byte buffers appended to it', function() {
    var data = utils.replayableBuffer(0);
    data.append(Buffer.from([48, 49, 50]));
    t.expectToBeBuffer(data.asBuffer(), Buffer.from([48, 49, 50]));
  });
  it('can have byte buffers appended to it beyond its initial size', function() {
    var data = utils.replayableBuffer(0);
    data.append(Buffer.from([48, 49, 50]));
    t.expectToBeBuffer(data.asBuffer(), Buffer.from([48, 49, 50]));
  });
  it('can be appended multiple times without reading', function() {
    var data = utils.replayableBuffer(0);
    data.append(Buffer.from([48, 49, 50]));
    data.append(Buffer.from([51, 52, 53]));
    t.expectToBeBuffer(data.asBuffer(), Buffer.from([48, 49, 50, 51, 52, 53]));
  });
});

describe('Address normalizer', function() {
  it('can normalize a single address', function() {
    var single = {port: 1234, host: '1.1.1.1'};
    var addr = utils.normalizeAddresses(single);
    expect(addr).toEqual([single]);
  });
  it('can normalize multiple address', function() {
    var multi = [{port: 1234, host: '1.1.1.1'}, {port: 2345, host: '2.2.2.2'}];
    var addrs = utils.normalizeAddresses(multi);
    expect(addrs).toEqual(multi);
  });
  it('can normalize when no addresses provided', function() {
    var local = {port: 11222, host: '127.0.0.1'};
    var addr = utils.normalizeAddresses();
    expect(addr).toEqual([local]);
  });
  it('throws an error when giving something unexpected', function() {
    expect(function() { return utils.normalizeAddresses('blah'); })
        .toThrow('Unknown server addresses: blah');
  });
});