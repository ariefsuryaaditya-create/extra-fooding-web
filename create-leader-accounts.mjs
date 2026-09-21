import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const groups = [
  ['EF', 'ef'],
  ['GALVANIZED_A1', 'galvanizeda1'],
  ['GALVANIZED_A2', 'galvanizeda2'],
  ['GALVANIZED_B1', 'galvanizedb1'],
  ['GALVANIZED_B2', 'galvanizedb2'],
  ['GALVANIZED_C1', 'galvanizedc1'],
  ['GALVANIZED_C2', 'galvanizedc2'],
  ['GALVANIZED_D', 'galvanizedd'],
  ['HRC_A1', 'hrca1'],
  ['HRC_A2', 'hrca2'],
  ['HRC_B1', 'hrcb1'],
  ['HRC_B2', 'hrcb2'],
  ['HRC_C1', 'hrcc1'],
  ['HRC_C2', 'hrcc2'],
  ['HRC_D', 'hrcd'],
  ['PACKING_A', 'packinga'],
  ['PACKING_B', 'packingb'],
  ['PACKING_C', 'packingc']
]

const password = '123456'

const { data: workGroups, error: groupError } =
  await supabase
    .from('work_groups')
    .select('id,code,name')

if (groupError) {
  console.error('Gagal mengambil work_groups:')
  console.error(groupError)
  process.exit(1)
}

const byCode = new Map(
  workGroups.map(group => [
    group.code.toUpperCase(),
    group
  ])
)

for (const [groupCode, emailCode] of groups) {

  const group = byCode.get(groupCode)

  if (!group) {
    console.log(`SKIP: kelompok tidak ditemukan: ${groupCode}`)
    continue
  }

  const email = `leader.${emailCode}@newasia.com`

  let user = null

  const {
    data: created,
    error: createError
  } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `Leader ${group.name}`
    }
  })

  if (!createError) {

    user = created.user

    console.log(`DIBUAT: ${email}`)

  } else if (
    createError.message?.toLowerCase().includes('already')
  ) {

    let page = 1

    while (!user && page <= 20) {

      const {
        data,
        error
      } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000
      })

      if (error) {
        console.error(error)
        break
      }

      user =
        data.users.find(
          u =>
            u.email?.toLowerCase() ===
            email.toLowerCase()
        ) || null

      if (data.users.length < 1000) break

      page++
    }

    if (user) {
      console.log(`SUDAH ADA: ${email}`)
    } else {
      console.log(`GAGAL MENEMUKAN AKUN: ${email}`)
    }

  } else {

    console.log(
      `GAGAL: ${email} -> ${createError.message}`
    )

    continue
  }

  if (!user) continue

  const {
    error: profileError
  } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: `Leader ${group.name}`,
      role: 'leader',
      work_group_id: group.id,
      active: true
    })

  if (profileError) {

    console.log(
      `PROFILE GAGAL: ${email} -> ${profileError.message}`
    )

  } else {

    console.log(
      `PROFILE OK: ${email} -> ${group.name}`
    )
  }
}

console.log('')
console.log('================================')
console.log('SELESAI MEMBUAT AKUN LEADER')
console.log('Password semua akun: 123456')
console.log('================================')