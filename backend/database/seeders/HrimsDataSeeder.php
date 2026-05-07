<?php

namespace Database\Seeders;

use App\Models\CompiledRecord;
use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\Region;
use App\Models\RegionalResponse;
use App\Models\ViolationEntry;
use Illuminate\Database\Seeder;

/**
 * Ported from hrims_old/constants.ts initial arrays (legacy province names → regions).
 */
class HrimsDataSeeder extends Seeder
{
    public function run(): void
    {
        $r = Region::all()->keyBy('name');

        $requests = [
            ['id' => 'REQ-2024-0150', 'title' => 'Women Rights Assessment', 'conv' => 'CEDAW', 'prov' => 'Punjab', 'date' => '2024-01-15', 'status' => 'completed'],
            ['id' => 'REQ-2024-0151', 'title' => 'Child Labor Investigation', 'conv' => 'CRC', 'prov' => 'Sindh', 'date' => '2024-02-20', 'status' => 'pending'],
            ['id' => 'REQ-2024-0152', 'title' => 'Torture Prevention Measures', 'conv' => 'CAT', 'prov' => 'Balochistan', 'date' => '2024-01-10', 'status' => 'overdue'],
            ['id' => 'REQ-2024-0153', 'title' => 'Disability Rights Implementation', 'conv' => 'CRPD', 'prov' => 'KPK', 'date' => '2024-02-28', 'status' => 'pending'],
            ['id' => 'REQ-2024-0154', 'title' => 'Economic Rights Survey', 'conv' => 'ICESCR', 'prov' => 'Islamabad', 'date' => '2024-01-20', 'status' => 'completed'],
            ['id' => 'REQ-2024-0155', 'title' => 'Political Rights Review', 'conv' => 'ICCPR', 'prov' => 'GB', 'date' => '2024-03-05', 'status' => 'pending'],
            ['id' => 'REQ-2024-0200', 'title' => 'Healthcare Accessibility Audit', 'conv' => 'ICESCR', 'prov' => 'Punjab', 'date' => '2024-04-15', 'status' => 'pending', 'details' => 'Conduct a full audit of rural healthcare centers regarding accessibility for disabled persons.'],
            ['id' => 'REQ-2024-0201', 'title' => 'Girls Education Enrollment Stats', 'conv' => 'CRC', 'prov' => 'Punjab', 'date' => '2024-04-20', 'status' => 'in-progress'],
            ['id' => 'REQ-2024-0202', 'title' => 'Prison Conditions Survey', 'conv' => 'CAT', 'prov' => 'Punjab', 'date' => '2024-04-25', 'status' => 'in-progress'],
            ['id' => 'REQ-2024-0203', 'title' => 'Labor Rights in Textile Department', 'conv' => 'ICESCR', 'prov' => 'Sindh', 'date' => '2024-05-10', 'status' => 'pending'],
            ['id' => 'REQ-2024-0300', 'title' => 'National Health Database Integrity Check', 'conv' => 'ICESCR', 'prov' => 'Federal', 'date' => '2024-05-01', 'status' => 'pending', 'details' => 'Verify the integrity of the national health database and report on access disparities.'],
            ['id' => 'REQ-2024-0301', 'title' => 'Federal Education Curriculum Review', 'conv' => 'CRC', 'prov' => 'Federal', 'date' => '2024-05-05', 'status' => 'pending', 'details' => 'Review the single national curriculum for inclusivity compliance.'],
        ];

        foreach ($requests as $row) {
            $region = $r[$row['prov']] ?? null;
            HrRequest::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'title' => $row['title'],
                    'conv' => $row['conv'],
                    'region_id' => $region?->id,
                    'due_date' => $row['date'],
                    'status' => $row['status'],
                    'details' => $row['details'] ?? null,
                ]
            );
        }

        $responses = [
            ['id' => 'RES-2024-001', 'req' => 'REQ-2024-0150', 'prov' => 'Punjab', 'title' => 'Women Rights Assessment - Punjab Report', 'sub' => '2024-02-15', 'rev' => 'pending', 'com' => '', 'content' => 'Punjab has implemented 15 new women protection centers across major districts.'],
            ['id' => 'RES-2024-002', 'req' => 'REQ-2024-0151', 'prov' => 'Sindh', 'title' => 'Women Rights Assessment - Sindh Report', 'sub' => '2024-02-18', 'rev' => 'accepted', 'com' => 'Good comprehensive report', 'content' => 'Sindh reports establishment of 12 women protection centers.'],
            ['id' => 'RES-2024-003', 'req' => 'REQ-2024-0152', 'prov' => 'Balochistan', 'title' => 'Women Rights Assessment - Balochistan Report', 'sub' => '2024-02-20', 'rev' => 'needs-modification', 'com' => 'Please include district-wise breakdown', 'content' => 'Balochistan has initiated 5 new protection centers.'],
            ['id' => 'RES-2024-004', 'req' => 'REQ-2024-0153', 'prov' => 'KPK', 'title' => 'Women Rights Assessment - KPK Report', 'sub' => '2024-02-22', 'rev' => 'pending', 'com' => '', 'content' => 'KPK established 8 women protection centers.'],
            ['id' => 'RES-2024-005', 'req' => 'REQ-2024-0154', 'prov' => 'Islamabad', 'title' => 'Child Protection Survey - ICT Report', 'sub' => '2024-03-01', 'rev' => 'accepted', 'com' => 'Excellent detailed report', 'content' => 'ICT child protection unit handled 450 cases.'],
            ['id' => 'RES-2024-006', 'req' => 'REQ-2024-0155', 'prov' => 'GB', 'title' => 'Child Protection Survey - GB Report', 'sub' => '2024-03-05', 'rev' => 'accepted', 'com' => 'Well documented', 'content' => 'GB child welfare initiatives cover all 10 districts.'],
        ];

        foreach ($responses as $row) {
            RegionalResponse::query()->updateOrCreate(
                ['id' => $row['id']],
                [
                    'hr_request_id' => $row['req'],
                    'region_id' => $r[$row['prov']]->id,
                    'title' => $row['title'],
                    'submission_date' => $row['sub'],
                    'review_status' => $row['rev'],
                    'comments' => $row['com'],
                    'content' => $row['content'],
                ]
            );
        }

        CompiledRecord::query()->updateOrCreate(
            ['id' => 'COMP-2024-001'],
            [
                'hr_request_id' => 'REQ-2024-0154',
                'title' => 'Child Protection Survey Q1 2024 - Compiled Report',
                'region_names' => ['Islamabad', 'GB'],
                'compilation_date' => '2024-03-10',
                'submitted_to' => 'Ministry of Human Rights',
                'submission_date' => '2024-03-12',
                'status' => 'submitted',
                'attachment' => 'COMP-2024-001-Final.pdf',
                'summary' => 'Consolidated findings indicate positive trends in child protection across the reporting regions.',
            ]
        );

        CompiledRecord::query()->updateOrCreate(
            ['id' => 'COMP-2024-002'],
            [
                'hr_request_id' => 'REQ-2024-0150',
                'title' => 'Women Rights National Assessment 2024 - Draft',
                'region_names' => ['Punjab', 'Sindh', 'Balochistan', 'KPK'],
                'compilation_date' => '2024-02-25',
                'submitted_to' => '',
                'submission_date' => null,
                'status' => 'draft',
                'attachment' => '',
                'summary' => 'Draft report awaiting final inputs.',
            ]
        );

        $dept = Department::all()->keyBy('code');

        $tasks = [
            ['id' => 'TSK-1001', 'req' => 'REQ-2024-0201', 'prov' => 'Punjab', 'dc' => 'SEC-EDU', 'st' => 'submitted', 'ad' => '2024-03-01', 'sd' => '2024-03-05', 'rd' => 'Enrollment increased by 15% in targeted districts.', 'url' => 'http://data.edu.pk/report.pdf'],
            ['id' => 'TSK-1002', 'req' => 'REQ-2024-0201', 'prov' => 'Punjab', 'dc' => 'SEC-SW', 'st' => 'assigned', 'ad' => '2024-03-01', 'sd' => null, 'rd' => null, 'url' => null],
            ['id' => 'TSK-2001', 'req' => 'REQ-2024-0202', 'prov' => 'Punjab', 'dc' => 'SEC-LAW', 'st' => 'submitted', 'ad' => '2024-03-10', 'sd' => '2024-03-15', 'rd' => 'Legal aid provided to 500 under-trial prisoners.', 'url' => 'http://law.gov.pk/prison-stats.xlsx'],
            ['id' => 'TSK-2002', 'req' => 'REQ-2024-0202', 'prov' => 'Punjab', 'dc' => 'SEC-POLICE', 'st' => 'submitted', 'ad' => '2024-03-10', 'sd' => '2024-03-14', 'rd' => 'Sanitation facilities upgraded in 3 Central Jails.', 'url' => 'http://police.punjab.gov.pk/jails.pdf'],
            ['id' => 'TSK-0099', 'req' => 'REQ-2024-0150', 'prov' => 'Punjab', 'dc' => 'SEC-HEALTH', 'st' => 'submitted', 'ad' => '2024-01-20', 'sd' => '2024-01-25', 'rd' => 'Women health centers operational in 36 districts.', 'url' => 'http://health.punjab.gov.pk/women.pdf'],
        ];

        foreach ($tasks as $t) {
            DepartmentTask::query()->updateOrCreate(
                ['id' => $t['id']],
                [
                    'hr_request_id' => $t['req'],
                    'region_id' => $r[$t['prov']]->id,
                    'department_id' => $dept[$t['dc']]->id,
                    'status' => $t['st'],
                    'assigned_date' => $t['ad'],
                    'submission_date' => $t['sd'],
                    'response_data' => $t['rd'],
                    'attachment_url' => $t['url'],
                ]
            );
        }

        ViolationEntry::query()->updateOrCreate(
            ['id' => 'violation-001'],
            [
                'entry_number' => 'EWS-12345678',
                'title' => 'Journalist Harassment Case in Karachi',
                'event_date' => '2024-01-15',
                'event_time' => '14:30',
                'event_year' => '2024',
                'region_id' => $r['Sindh']->id,
                'district' => 'Karachi Central',
                'violation_category' => 'protection-life-liberty',
                'violation_sub_category' => 'journalist',
                'violation_indicator' => null,
                'monitoring_status' => 'in-progress',
                'description' => 'A prominent journalist was harassed and threatened while covering a political rally.',
            ]
        );

        ViolationEntry::query()->updateOrCreate(
            ['id' => 'violation-002'],
            [
                'entry_number' => 'EWS-23456789',
                'title' => 'Gender-Based Violence Incident in Lahore',
                'event_date' => '2024-02-10',
                'event_time' => '18:45',
                'event_year' => '2024',
                'region_id' => $r['Punjab']->id,
                'district' => 'Lahore',
                'violation_category' => 'gbv',
                'violation_sub_category' => 'domestic',
                'violation_indicator' => null,
                'monitoring_status' => 'resolved',
                'description' => 'Case referred to district committee; survivor provided legal aid.',
            ]
        );
    }
}
