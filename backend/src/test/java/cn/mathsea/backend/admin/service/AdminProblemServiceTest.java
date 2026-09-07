package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.admin.vo.AdminProblemVO;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import cn.mathsea.backend.problem.entity.Problem;
import cn.mathsea.backend.problem.entity.ProblemSource;
import cn.mathsea.backend.problem.mapper.ProblemAssetMapper;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.problem.mapper.ProblemSourceMapper;
import cn.mathsea.backend.problem.mapper.ProblemTagMapper;
import cn.mathsea.backend.problem.mapper.TagMapper;
import cn.mathsea.backend.problem.service.ProblemService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminProblemServiceTest {
    @Mock private ProblemMapper problemMapper;
    @Mock private ProblemSourceMapper sourceMapper;
    @Mock private TagMapper tagMapper;
    @Mock private ProblemTagMapper problemTagMapper;
    @Mock private ProblemAssetMapper assetMapper;
    @Mock private ProblemService problemService;
    @Mock private LocalFileStorageService storageService;
    @Mock private AuditLogService auditLogService;
    @InjectMocks private AdminProblemService service;

    @Test
    void markdownIdOverridesLegacyProblemNumber() {
        String markdown = """
                ---
                id:P10002
                year:2020
                source:北京卷
                question_type:单项选择题
                difficulty:red
                number:T1
                title:二次函数基础
                problem_number:0
                ---
                content:
                题目内容
                answer:
                A
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "2020-difang-beijingjuan_xingaokao-1.md",
                "text/markdown",
                markdown.getBytes(StandardCharsets.UTF_8)
        );

        ProblemSource localSource = new ProblemSource();
        localSource.setCode("local");
        localSource.setLabel("地方卷");
        localSource.setActive(true);
        when(sourceMapper.selectById(any())).thenAnswer(invocation ->
                "local".equals(invocation.getArgument(0)) ? localSource : null
        );

        AtomicReference<Problem> inserted = new AtomicReference<>();
        doAnswer(invocation -> {
            Problem problem = invocation.getArgument(0);
            problem.setId(1L);
            inserted.set(problem);
            return 1;
        }).when(problemMapper).insert(any(Problem.class));
        when(problemMapper.selectById(1L)).thenAnswer(invocation -> inserted.get());
        when(assetMapper.findByProblemId(1L)).thenReturn(List.of());
        when(problemTagMapper.selectNamesByProblemId(1L)).thenReturn(List.of());

        AdminProblemVO imported = service.importMarkdown(7L, file);

        assertEquals("P10002", imported.problemNumber());
        verify(problemMapper, never()).findByProblemNumber("0");
    }
}
