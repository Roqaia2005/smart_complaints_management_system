const bcrypt = require('bcryptjs');

// ============ Helpers ============
function randomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeightedIndex(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}

// Academic-year calendar: Jul 2025 -> Jun 2026 (12 months)
const monthDefs = [
  { year: 2025, month: 7 },  { year: 2025, month: 8 },  { year: 2025, month: 9 },
  { year: 2025, month: 10 }, { year: 2025, month: 11 }, { year: 2025, month: 12 },
  { year: 2026, month: 1 },  { year: 2026, month: 2 },  { year: 2026, month: 3 },
  { year: 2026, month: 4 },  { year: 2026, month: 5 },  { year: 2026, month: 6 }
];

const NOW = new Date('2026-07-01T00:00:00Z');

function clamp(date) {
  return date > NOW ? new Date(NOW) : date;
}

// Friday/Saturday = weekend in Egypt -> lower complaint volume
function isRejectedWeekendDay(date) {
  const dow = date.getDay(); // 0 Sun ... 5 Fri, 6 Sat
  if (dow === 5) return Math.random() < 0.8;
  if (dow === 6) return Math.random() < 0.5;
  return false;
}

function randomDateInMonth(monthIdx) {
  const { year, month } = monthDefs[monthIdx];
  const daysInMonth = new Date(year, month, 0).getDate();
  let date;
  let attempts = 0;
  do {
    const day = randomInt(1, daysInMonth);
    date = new Date(year, month - 1, day, randomInt(8, 21), randomInt(0, 59));
    attempts++;
  } while (isRejectedWeekendDay(date) && attempts < 6);
  return clamp(date);
}

// Status depends on how "old" the complaint is - can't have a pending complaint from 6 months ago
function pickStatus(createdAt) {
  const daysAgo = (NOW - createdAt) / (1000 * 60 * 60 * 24);
  if (daysAgo > 30) {
    const options = ['resolved', 'appealed', 'in_progress', 'pending'];
    return options[pickWeightedIndex([68, 17, 10, 5])];
  } else if (daysAgo > 7) {
    const options = ['pending', 'in_progress', 'resolved', 'appealed'];
    return options[pickWeightedIndex([15, 25, 50, 10])];
  } else {
    const options = ['pending', 'in_progress', 'resolved'];
    return options[pickWeightedIndex([50, 35, 15])];
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();

    try {
      const salt = await bcrypt.genSalt(10);
      const defaultPasswordHash = await bcrypt.hash('password123', salt);

      console.log('⏳ 0. Checking University and Faculty to prevent duplication...');

      const universityName = 'Tanta University';
      const existingUni = await queryInterface.sequelize.query(
        `SELECT id FROM "Universities" WHERE name = '${universityName}';`,
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
      );

      let universityId;
      if (existingUni.length === 0) {
        const uniRows = await queryInterface.bulkInsert('Universities', [{
          name: universityName, createdAt: new Date(), updatedAt: new Date()
        }], { transaction: t, returning: ['id'] });
        universityId = uniRows[0].id;
      } else {
        universityId = existingUni[0].id;
      }

      const facultyName = 'Faculty of Computers and Artificial Intelligence';
      const existingFac = await queryInterface.sequelize.query(
        `SELECT id FROM "faculties" WHERE name = '${facultyName}' AND university_id = ${universityId};`,
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
      );

      let facultyId;
      if (existingFac.length === 0) {
        const facRows = await queryInterface.bulkInsert('faculties', [{
          name: facultyName, email_domain: 'fci-cu.edu.eg', university_id: universityId,
          createdAt: new Date(), updatedAt: new Date()
        }], { transaction: t, returning: ['id'] });
        facultyId = facRows[0].id;
        console.log(`✨ Created a new Faculty with ID: ${facultyId}`);
      } else {
        facultyId = existingFac[0].id;
        console.log(`ℹ️ Faculty already exists with ID: ${facultyId} (Prevented duplication).`);
      }

      console.log('⏳ 1. Creating Admin Account...');
      const adminEmails = ['admin.faculty@university.edu.eg'];
      const existingAdmin = await queryInterface.sequelize.query(
        `SELECT id FROM "users" WHERE email = '${adminEmails[0]}';`,
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
      );

      if (existingAdmin.length === 0) {
        await queryInterface.bulkInsert('users', [{
          full_name: 'Main Faculty Admin', email: adminEmails[0], password_hash: defaultPasswordHash,
          role: 'admin', is_active: true, faculty_id: facultyId, is_also_manager: false,
          createdAt: new Date(), updatedAt: new Date()
        }], { transaction: t, returning: ['id'] });
      }

      console.log('⏳ 2. Creating Categories...');
      const categoriesData = [
        { name: 'شؤون الطلاب', description: 'مشاكل القيد، شهادات التخرج، والملفات الأكاديمية', sla_hours: 48 },
        { name: 'الخدمات التقنية والمنصات', description: 'مشاكل تسجيل المواد، الإيميل الجامعي، والشبكات', sla_hours: 24 },
        { name: 'المصاريف والدفع الإلكتروني', description: 'مشاكل الخزنة، الدفع البنكي، والمنح الدراسية', sla_hours: 36 },
        { name: 'المرافق والصيانة', description: 'المكيفات، المصاعد، نظافة المدرجات، والمعامل', sla_hours: 12 },
        { name: 'العيادات والخدمات الطبية', description: 'الكشوفات، الأعذار الطبية، ونقص الأدوية', sla_hours: 6 }
      ];

      const createdCategories = [];
      for (const cat of categoriesData) {
        const existingCat = await queryInterface.sequelize.query(
          `SELECT id FROM "categories" WHERE name = '${cat.name}' AND faculty_id = ${facultyId};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
        );
        if (existingCat.length === 0) {
          const catRows = await queryInterface.bulkInsert('categories', [{
            faculty_id: facultyId, name: cat.name, description: cat.description, sla_hours: cat.sla_hours,
            is_active: true, createdAt: new Date(), updatedAt: new Date()
          }], { transaction: t, returning: ['id'] });
          createdCategories.push(catRows[0].id);
        } else {
          createdCategories.push(existingCat[0].id);
        }
      }

      console.log('⏳ 3. Creating Officers and binding to Categories...');
      const officerEmails = [
        'officer.students@university.edu.eg', 'officer.tech@university.edu.eg',
        'officer.finance@university.edu.eg', 'officer.services@university.edu.eg',
        'officer.medical@university.edu.eg'
      ];

      const officerIds = [];
      for (let i = 0; i < officerEmails.length; i++) {
        const existingOff = await queryInterface.sequelize.query(
          `SELECT id FROM "users" WHERE email = '${officerEmails[i]}';`,
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
        );
        let offId;
        if (existingOff.length === 0) {
          const offRows = await queryInterface.bulkInsert('users', [{
            full_name: `Officer for ${categoriesData[i].name}`, email: officerEmails[i],
            password_hash: defaultPasswordHash, role: 'officer', is_active: true, faculty_id: facultyId,
            is_also_manager: false, officer_title: `Responsible for ${categoriesData[i].name}`,
            createdAt: new Date(), updatedAt: new Date()
          }], { transaction: t, returning: ['id'] });
          offId = offRows[0].id;
        } else {
          offId = existingOff[0].id;
        }
        officerIds.push(offId);

        const existingPivot = await queryInterface.sequelize.query(
          `SELECT id FROM "CategoryOfficers" WHERE category_id = ${createdCategories[i]} AND officer_id = ${offId};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
        );
        if (existingPivot.length === 0) {
          await queryInterface.bulkInsert('CategoryOfficers', [{
            category_id: createdCategories[i], officer_id: offId, assigned_at: new Date(),
            officer_type: `Responsible for ${categoriesData[i].name}`
          }], { transaction: t });
        }
      }

      console.log('⏳ 4. Provisioning 50 Students in both Students and users tables...');
      const studentUserIds = [];
      for (let i = 1; i <= 50; i++) {
        const studentEmail = `student.test${i}@university.edu.eg`;
        const existingStu = await queryInterface.sequelize.query(
          `SELECT id FROM "Students" WHERE email = '${studentEmail}';`,
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
        );
        let sId;
        if (existingStu.length === 0) {
          const stuRows = await queryInterface.bulkInsert('Students', [{
            student_number: String(20265000 + i), full_name: `Test Student Number ${i}`, email: studentEmail,
            department: i % 2 === 0 ? 'Computer Science' : 'Information Systems', academic_year: (i % 4) + 1,
            faculty_id: facultyId, createdAt: new Date(), updatedAt: new Date()
          }], { transaction: t, returning: ['id'] });
          sId = stuRows[0].id;
        } else {
          sId = existingStu[0].id;
        }

        const existingUserStu = await queryInterface.sequelize.query(
          `SELECT id FROM "users" WHERE student_id = ${sId};`,
          { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
        );
        if (existingUserStu.length === 0) {
          const userRows = await queryInterface.bulkInsert('users', [{
            student_id: sId, full_name: `Test Student Number ${i}`, email: studentEmail,
            password_hash: defaultPasswordHash, role: 'student', is_active: true, faculty_id: facultyId,
            is_also_manager: false, createdAt: new Date(), updatedAt: new Date()
          }], { transaction: t, returning: ['id'] });
          studentUserIds.push(userRows[0].id);
        } else {
          studentUserIds.push(existingUserStu[0].id);
        }
      }

      console.log('⏳ 5. Fetching Appeals status enum dynamically...');
      const appealStatusRows = await queryInterface.sequelize.query(
        `SELECT unnest(enum_range(NULL::"enum_Appeals_status")) AS status;`,
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction: t }
      );
      const appealStatuses = appealStatusRows.map(r => r.status);
      const pendingAppealStatus = appealStatuses.find(s => /pend/i.test(s)) || appealStatuses[0];
      const closedAppealStatuses = appealStatuses.filter(s => s !== pendingAppealStatus);
      const rejectAppealStatuses = closedAppealStatuses.filter(s => /reject/i.test(s));
      const approveAppealStatuses = closedAppealStatuses.filter(s => !/reject/i.test(s));

      console.log('⏳ 6. Generating 900 realistic complaints across a full academic year...');

      // problem bank: 6 problem/resolution pairs per category, matched by index
      const problemBank = [
        {
          catIdx: 0,
          problems: [
            'تأخر استخراج إفادة القيد الموجهة للتجنيد',
            'خطأ في تسجيل التخصص الدراسي بالملف الإلكتروني',
            'طلب تعديل عذر طبي غياب لم يتم البت فيه',
            'الاسم مكتوب غلط في شهادة التخرج المؤقتة',
            'طلب تحويل من قسم لقسم تاني ورد الطلب بدون سبب واضح',
            'فقدان ملف الطالب الورقي عند التحويل بين الكليات'
          ],
          resolutions: [
            'تم مراجعة شباك شؤون الطلاب واعتماد الإفادة الورقية وإرسال نسخة رقمية للطالب مباشرة.',
            'تم تعديل مسار التخصص على السيستم وتعيين المرشد الأكاديمي للقسم الجديد.',
            'تم قبول العذر الطبي واعتماده من عميد الكلية ورفع الغياب عن المحاضرات المحددة.',
            'تم تصحيح البيانات في نظام شؤون الطلاب وإصدار شهادة تخرج مؤقتة معدّلة ومطابقة للسجلات الرسمية.',
            'تمت إعادة النظر في طلب التحويل بعد مراجعة الأوراق وتم قبوله رسمياً مع تحديث الجدول الدراسي.',
            'تم الرجوع لأرشيف الكلية القديمة واسترجاع نسخة من الملف وإدراجه ضمن ملف الطالب الحالي.'
          ]
        },
        {
          catIdx: 1,
          problems: [
            'المنصة تظهر شاشة بيضاء أثناء محاولة تسجيل مواد الترم الحالي',
            'الإيميل الجامعي مغلق ولا يستقبل كود تفعيل بنك المعرفة',
            'شبكة الواي فاي في مدرج ج تفصل باستمرار',
            'تطبيق الجوال الخاص بالجامعة يطلب تسجيل دخول مستمر ولا يحفظ الجلسة',
            'لا يمكن الوصول لمنصة البلاك بورد لتسليم الواجب قبل الديدلاين بساعة',
            'كاميرا قاعة الامتحانات الإلكترونية لا تعمل أثناء الاختبار'
          ],
          resolutions: [
            'تم صيانة خادم التسجيل وزيادة سرعة الاستجابة وفتح البوابة للطالب لإتمام الحذف والإضافة.',
            'تم عمل إعادة ضبط للحساب وتنشيط بريد الطالب الموحد وجاري استقبال الأكواد كالمعتاد.',
            'تم تركيب نقطة تقوية (Access Point) جديدة داخل المدرج واختبار استقرار البث الفني.',
            'تم تحديث إصدار التطبيق وإصلاح خلل الجلسة، والتطبيق الآن يحفظ الدخول بشكل طبيعي.',
            'تم رفع الحمل عن سيرفر بلاك بورد وفتح نافذة تسليم استثنائية للطلاب المتأثرين.',
            'تم استبدال الكاميرا التالفة فوراً وإعادة جدولة الجزء المتأثر من الامتحان دون أي خصم.'
          ]
        },
        {
          catIdx: 2,
          problems: [
            'تم خصم المصاريف من الفيزا مرتين والحالة لم تتغير إلى مدفوع',
            'طلب تقسيط المصاريف الدراسية بسبب ظروف عائلية',
            'الموقع لا يقبل رفع إيصال سداد رسوم الكارنيه',
            'لم يتم صرف قيمة المنحة الدراسية في الموعد المحدد',
            'رسالة خطأ عند محاولة طباعة إيصال السداد الإلكتروني',
            'الخصم من حساب الطالب تم بعملة خاطئة مما سبب فرق كبير في المبلغ'
          ],
          resolutions: [
            'تم مراجعة كشف البنك الشريك وتسوية الحركة المالية المزدوجة وتحديث حالة الحساب لمدفوع.',
            'تمت الموافقة على جدولة الرسوم المقررة على دفعتين وتحديث الفاتورة الإلكترونية للطالب.',
            'تم حل المشكلة البرمجية في شاشة المرفقات ويمكن الآن رفع صور الإيصالات بصيغة JPG بنجاح.',
            'تم التواصل مع الإدارة المالية وصرف قيمة المنحة كاملة خلال 48 ساعة مع اعتذار عن التأخير.',
            'تم حل مشكلة السيرفر الخاص بالإيصالات ويمكن الآن طباعة الإيصال الإلكتروني بصيغة PDF بدون مشاكل.',
            'تم تصحيح فرق العملة ورد المبلغ الزائد لحساب الطالب خلال يومي عمل.'
          ]
        },
        {
          catIdx: 3,
          problems: [
            'تكييف قاعة 204 بالدور الثاني يسرب مياه ولا يبرد',
            'مصعد مبنى ب معطل والطلاب يضطرون للصعود بالسلالم للمختبرات',
            'نقص المقاعد الخشبية في سكشن الرسم الهندسي',
            'دورات المياه بالدور الأرضي بدون مياه منذ يومين',
            'إضاءة الممر الخارجي بين المبنيين معطلة مما يشكل خطورة مسائية',
            'رائحة كريهة داخل معمل الكيمياء بسبب سوء التهوية'
          ],
          resolutions: [
            'تم استدعاء فريق الصيانة وتغيير فلاتر التكييف المسدودة وشحن الفريون ليعمل بكفاءة.',
            'تم صيانة محرك المصعد وتغيير الكابلات التالفة واجتياز اختبار الأمان التشغيلي.',
            'تم تزويد القاعة بـ 15 مقعد إضافي بمساند مريحة لاستيعاب الكثافة الطلابية المتواجدة.',
            'تم إصلاح كسر في خط المياه الرئيسي وتشغيل دورات المياه بشكل طبيعي فوراً.',
            'تم استبدال لمبات الإضاءة التالفة وتركيب حساسات حركة لتحسين الأمان المسائي.',
            'تم صيانة شفاطات التهوية وتنظيف فلاتر المعمل وتحسين دوران الهواء بالكامل.'
          ]
        },
        {
          catIdx: 4,
          problems: [
            'عدم وجود طبيب في عيادة الكلية خلال الفترة المسائية',
            'صيدلية العيادة تفتقر إلى مسكنات الآلام الأساسية وأدوات الإسعافات',
            'تأخر توثيق التقرير الطبي الخاص بحادث الطالب',
            'نفاد اللقاح الموسمي من العيادة قبل بدء حملة التطعيم',
            'عدم توفر سيارة إسعاف بالكلية أثناء حالة طارئة لطالب',
            'الممرضة المناوبة رفضت تحرير تقرير طبي رغم وجود حالة واضحة'
          ],
          resolutions: [
            'تم التنسيق لتغطية الشيفت المسائي بطبيب بديل مكافئ لضمان الرعاية الصحية المستمرة للطلاب.',
            'تم توريد شحنة إسعافات أولية عاجلة وأدوية الطوارئ الأساسية لعهدة الصيدلية المركزية.',
            'تم فحص التقرير من اللجنة الطبية المعتمدة وتوقيعه وتسليمه لإدارة شؤون الطلاب فوراً.',
            'تم التنسيق مع مستشفى الجامعة لتوفير دفعة إضافية من اللقاحات وإطلاق حملة تطعيم فورية.',
            'تم التعاقد مع سيارة إسعاف مخصصة تتواجد بالكلية خلال ساعات الدوام الكامل بدءاً من الأسبوع القادم.',
            'تم مراجعة الواقعة مع رئيسة التمريض وتحرير التقرير الطبي المطلوب فوراً مع تنبيه الطاقم على الإجراء الصحيح.'
          ]
        }
      ];

      const locationPools = [
        ['مكتب شئون الطلاب - الدور الأول', 'شباك القيد والتسجيل', 'إدارة الكلية', 'مكتب الوافدين'],
        ['بوابة التسجيل الإلكترونية', 'معمل الحاسبات 2', 'مركز تكنولوجيا المعلومات', 'شبكة مدرج ج'],
        ['الخزينة الرئيسية', 'شباك الشئون المالية', 'بوابة الدفع الإلكتروني', 'مكتب المنح والمساعدات'],
        ['مبنى أ - الدور الثاني', 'مبنى ب - المصعد', 'قاعة 204', 'معمل الكيمياء', 'دورات مياه الدور الأرضي'],
        ['العيادة الطبية المركزية', 'صيدلية الكلية', 'غرفة الإسعافات الأولية']
      ];

      const sincePhrases = ['من يومين', 'من أسبوع تقريباً', 'من بداية الترم', 'اليوم فجأة', 'من كذا يوم', 'من أول الشهر ده', 'من الأسبوع اللي فات'];

      const appealReasons = [
        'الحل المقدم لم يعالج المشكلة الأساسية وما زلت أواجه نفس الصعوبة',
        'أرى أن القرار غير عادل نظراً لظروفي الخاصة التي لم يتم أخذها في الاعتبار',
        'المدة المستغرقة لحل المشكلة تجاوزت الحد المعقول ولم أحصل على تعويض مناسب',
        'المعلومات المذكورة في الرد لا تطابق ما حدث فعلياً معي'
      ];
      const appealApproveResponses = [
        'تم مراجعة الاستئناف والتأكد من صحة الملاحظات، وتم اتخاذ الإجراء التصحيحي اللازم فوراً.',
        'بعد الفحص تبين أن هناك تقصير في الحل الأول، وتم إعادة معالجة الشكوى بالكامل.'
      ];
      const appealRejectResponses = [
        'تم مراجعة الاستئناف بدقة والتأكد من أن الحل الأول كان مطابقاً للوائح المعمول بها ولم يتم العثور على أي تقصير.',
        'بعد التحقق من كافة التفاصيل، تبين أن الإجراء المتخذ كان صحيحاً ولا يوجد أساس لتعديل القرار.'
      ];

      // Relative volume per category
      const categoryBaseWeights = [22, 28, 18, 20, 12];

      // Monthly multipliers per category, index matches monthDefs (Jul25...Jun26)
      // Sept/Feb = semester start rush, Dec/May = finals, Jul/Aug = summer break
      const categoryMonthlyWeights = [
        [4, 5, 10, 6, 5, 9, 6, 8, 6, 7, 10, 9],   // شؤون الطلاب: registration + finals grade issues + graduation (June)
        [3, 4, 10, 7, 5, 9, 7, 10, 6, 6, 9, 5],   // تقنية: registration rush (Sept/Feb) + finals portal load
        [3, 3, 10, 6, 4, 7, 5, 9, 5, 4, 6, 4],    // مصاريف: tuition deadlines (Sept/Feb)
        [8, 7, 6, 5, 5, 4, 4, 4, 5, 5, 4, 6],     // مرافق: summer heat/maintenance high, exam season lower
        [3, 3, 5, 5, 6, 9, 6, 5, 6, 7, 9, 5]      // طبي: finals stress spikes (Dec/May)
      ];

      const TOTAL_COMPLAINTS = 900;
      const complaintsToInsert = [];
      const complaintsMeta = [];

      for (let i = 0; i < TOTAL_COMPLAINTS; i++) {
        const catIdx = pickWeightedIndex(categoryBaseWeights);
        const monthIdx = pickWeightedIndex(categoryMonthlyWeights[catIdx]);
        const createdAt = randomDateInMonth(monthIdx);
        const status = pickStatus(createdAt);
        const slaHours = categoriesData[catIdx].sla_hours;

        const bankItem = problemBank[catIdx];
        const probIdx = randomInt(0, bankItem.problems.length - 1);
        const problemText = bankItem.problems[probIdx];
        const resolutionText = bankItem.resolutions[probIdx];

        let inProgressAt = null, resolvedAt = null, appealCreatedAt = null;

        if (status !== 'pending') {
          inProgressAt = clamp(new Date(createdAt.getTime() + randomInt(1, Math.max(2, slaHours)) * 3600000));
        }
        if (status === 'resolved' || status === 'appealed') {
          const delayHours = randomInt(Math.max(1, Math.round(slaHours * 0.5)), Math.max(2, slaHours * 2));
          resolvedAt = clamp(new Date(inProgressAt.getTime() + delayHours * 3600000));
        }
        if (status === 'appealed') {
          appealCreatedAt = clamp(new Date(resolvedAt.getTime() + randomInt(24, 96) * 3600000));
        }

        const row = {
          user_id: pick(studentUserIds),
          category_id: createdCategories[catIdx],
          problem: problemText,
          location: pick(locationPools[catIdx]),
          since: pick(sincePhrases),
          priority: randomInt(1, 3),
          status: status,
          createdAt: createdAt,
          updatedAt: appealCreatedAt || resolvedAt || inProgressAt || createdAt,
          sla_deadline: new Date(createdAt.getTime() + slaHours * 3600000)
        };

        if (status !== 'pending') row.assigned_officer_id = officerIds[catIdx];
        if (status === 'resolved' || status === 'appealed') {
          row.resolution_text = resolutionText;
          row.resolved_at = resolvedAt;
        }

        complaintsToInsert.push(row);
        complaintsMeta.push({ catIdx, status, createdAt, inProgressAt, resolvedAt, appealCreatedAt });
      }

      const insertedComplaints = await queryInterface.bulkInsert('Complaints', complaintsToInsert, {
        transaction: t, returning: ['id']
      });

      console.log('⏳ 7. Building complaint_histories and Appeals from generated transitions...');
      const historiesToInsert = [];
      const appealsToInsert = [];

      insertedComplaints.forEach((rec, i) => {
        const complaintId = rec.id;
        const meta = complaintsMeta[i];
        const row = complaintsToInsert[i];
        const studentUserId = row.user_id;
        const officerId = officerIds[meta.catIdx];

        historiesToInsert.push({
          complaint_id: complaintId, status: 'pending', changed_by: studentUserId, changed_at: meta.createdAt
        });

        if (meta.status !== 'pending') {
          historiesToInsert.push({
            complaint_id: complaintId, status: 'in_progress', changed_by: officerId, changed_at: meta.inProgressAt
          });
        }
        if (meta.status === 'resolved' || meta.status === 'appealed') {
          historiesToInsert.push({
            complaint_id: complaintId, status: 'resolved', changed_by: officerId, changed_at: meta.resolvedAt
          });
        }
        if (meta.status === 'appealed') {
          historiesToInsert.push({
            complaint_id: complaintId, status: 'appealed', changed_by: studentUserId, changed_at: meta.appealCreatedAt
          });

          const isClosed = Math.random() < 0.7 && closedAppealStatuses.length > 0;
          const reason = pick(appealReasons);

          if (isClosed) {
            const goesApproved = approveAppealStatuses.length > 0 && Math.random() < 0.5;
            const finalStatus = goesApproved
              ? pick(approveAppealStatuses.length ? approveAppealStatuses : closedAppealStatuses)
              : pick(rejectAppealStatuses.length ? rejectAppealStatuses : closedAppealStatuses);
            const respondedAt = clamp(new Date(meta.appealCreatedAt.getTime() + randomInt(12, 72) * 3600000));
            const responseText = /reject/i.test(finalStatus) ? pick(appealRejectResponses) : pick(appealApproveResponses);

            appealsToInsert.push({
              complaint_id: complaintId, responded_by: officerId, reason: reason,
              status: finalStatus, response_text: responseText, responded_at: respondedAt,
              createdAt: meta.appealCreatedAt, updatedAt: respondedAt
            });
          } else {
            appealsToInsert.push({
              complaint_id: complaintId, responded_by: null, reason: reason,
              status: pendingAppealStatus, response_text: null, responded_at: null,
              createdAt: meta.appealCreatedAt, updatedAt: meta.appealCreatedAt
            });
          }
        }
      });

      await queryInterface.bulkInsert('complaint_histories', historiesToInsert, { transaction: t });
      if (appealsToInsert.length) {
        await queryInterface.bulkInsert('Appeals', appealsToInsert, { transaction: t });
      }

      await t.commit();
      console.log(`✅ Seeding completed: ${TOTAL_COMPLAINTS} complaints, ${historiesToInsert.length} history entries, ${appealsToInsert.length} appeals.`);

    } catch (error) {
      await t.rollback();
      console.error('❌ Error occurred, transaction rolled back:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Appeals', null, {});
    await queryInterface.bulkDelete('complaint_histories', null, {});
    await queryInterface.bulkDelete('Complaints', null, {});
    await queryInterface.bulkDelete('CategoryOfficers', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('categories', null, {});
    await queryInterface.bulkDelete('Students', null, {});
  }
};