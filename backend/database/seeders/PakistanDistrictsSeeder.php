<?php

namespace Database\Seeders;

use App\Models\District;
use App\Models\Region;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Pakistan administrative districts by region (RegionSeeder slugs).
 * Punjab 41 districts per 2023 census division list; other provinces aligned with
 * PBS / common official naming used in national applications.
 */
class PakistanDistrictsSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->districtsByRegionSlug() as $regionSlug => $rows) {
            $region = Region::query()->where('slug', $regionSlug)->first();
            if (! $region || $rows === []) {
                continue;
            }

            foreach ($rows as $row) {
                $name = is_array($row) ? $row['name'] : $row;
                $slug = is_array($row) && isset($row['slug'])
                    ? $row['slug']
                    : Str::slug($name);

                District::query()->updateOrCreate(
                    [
                        'region_id' => $region->id,
                        'slug' => $slug,
                    ],
                    [
                        'name' => $name,
                    ]
                );
            }
        }
    }

    /**
     * @return array<string, list<string|array{name: string, slug?: string}>>
     */
    private function districtsByRegionSlug(): array
    {
        return [
            'islamabad' => [
                'Islamabad',
            ],

            // Punjab — 41 districts (2023 administrative map, Wikipedia / provincial notification)
            'punjab' => [
                'Bahawalnagar',
                'Bahawalpur',
                'Rahim Yar Khan',
                'Dera Ghazi Khan',
                'Kot Addu',
                'Layyah',
                'Muzaffargarh',
                'Rajanpur',
                'Taunsa',
                'Chiniot',
                'Faisalabad',
                'Jhang',
                'Toba Tek Singh',
                'Gujranwala',
                'Narowal',
                'Sialkot',
                'Gujrat',
                'Hafizabad',
                'Mandi Bahauddin',
                'Wazirabad',
                'Lahore',
                'Nankana Sahib',
                'Kasur',
                'Sheikhupura',
                'Khanewal',
                'Lodhran',
                'Multan',
                'Vehari',
                'Attock',
                'Chakwal',
                'Jhelum',
                'Murree',
                'Rawalpindi',
                'Talagang',
                'Okara',
                'Pakpattan',
                'Sahiwal',
                'Bhakkar',
                'Khushab',
                'Mianwali',
                'Sargodha',
            ],

            // Sindh — 30 districts (incl. Karachi divisions; Kemari; Qambar Shahdadkot)
            'sindh' => [
                'Badin',
                'Dadu',
                'Ghotki',
                'Hyderabad',
                'Jacobabad',
                'Jamshoro',
                'Karachi Central',
                'Karachi East',
                'Karachi South',
                'Karachi West',
                'Karachi Malir',
                'Karachi Korangi',
                'Kashmore',
                'Khairpur',
                'Larkana',
                'Matiari',
                'Mirpur Khas',
                'Naushahro Feroze',
                'Shaheed Benazirabad',
                'Sanghar',
                'Shikarpur',
                'Sujawal',
                'Sukkur',
                'Tando Allahyar',
                'Tando Muhammad Khan',
                'Thatta',
                'Tharparkar',
                'Umerkot',
                ['name' => 'Kemari', 'slug' => 'kemari'],
                ['name' => 'Qambar Shahdadkot', 'slug' => 'qambar-shahdadkot'],
            ],

            'kpk' => [
                'Abbottabad',
                'Bajaur',
                'Bannu',
                'Buner',
                'Charsadda',
                'Chitral Lower',
                'Chitral Upper',
                'Dir Lower',
                'Dir Upper',
                'Hangu',
                'Haripur',
                'Karak',
                'Khyber',
                'Kohat',
                'Kohistan Lower',
                'Kohistan Upper',
                'Kolai Palas Kohistan',
                'Kurram',
                'Lakki Marwat',
                'Malakand',
                'Mansehra',
                'Mardan',
                'Mohmand',
                'North Waziristan',
                'Nowshera',
                'Orakzai',
                'Peshawar',
                'Shangla',
                'Swabi',
                'Swat',
                'Tank',
                'Torghar',
                ['name' => 'Dera Ismail Khan', 'slug' => 'dera-ismail-khan'],
                ['name' => 'Upper South Waziristan', 'slug' => 'upper-south-waziristan'],
                ['name' => 'Lower South Waziristan', 'slug' => 'lower-south-waziristan'],
            ],

            'balochistan' => [
                'Awaran',
                'Barkhan',
                'Chagai',
                'Chaman',
                'Dera Bugti',
                'Duki',
                'Gwadar',
                'Harnai',
                'Hub',
                'Jaffarabad',
                'Jhal Magsi',
                'Kalat',
                'Kharan',
                'Killa Abdullah',
                'Killa Saifullah',
                'Kohlu',
                'Lasbela',
                'Lehri',
                'Loralai',
                'Mastung',
                'Musakhel',
                'Naseerabad',
                'Nushki',
                'Panjgur',
                'Pishin',
                'Quetta',
                'Sherani',
                'Sibi',
                'Sohbatpur',
                'Surab',
                'Usta Muhammad',
                'Washuk',
                'Zhob',
                'Kachhi',
                'Kech',
                'Khuzdar',
            ],

            'gb' => [
                'Astore',
                'Diamer',
                'Ghanche',
                'Ghizer',
                'Gilgit',
                ['name' => 'Gupis Yasin', 'slug' => 'gupis-yasin'],
                'Hunza',
                'Kharmang',
                'Nagar',
                'Shigar',
                'Skardu',
                ['name' => 'Roundu', 'slug' => 'roundu'],
                ['name' => 'Tangir', 'slug' => 'tangir'],
                ['name' => 'Darel', 'slug' => 'darel'],
            ],

            'ajk' => [
                'Bagh',
                'Bhimber',
                'Hattian Bala',
                'Haveli',
                'Kotli',
                'Mirpur',
                'Muzaffarabad',
                'Neelum',
                'Poonch',
                'Sudhanoti',
            ],

            'federal' => [],
        ];
    }
}
